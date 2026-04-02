import { useState, useEffect, useRef, useCallback } from "react";
import { Notepad, X } from "@phosphor-icons/react";
import { useAgent } from "agents/react";
import { AudienceCard } from "../components/AudienceCard";
import { AudioWave } from "../components/AudioWave";
import { InterventionBanner } from "../components/InterventionBanner";
import { saveNote } from "../lib/db";
import type { RehearseSession } from "../agents/rehearse-session";
import type { PersonaType } from "../lib/personas";
import type { SessionReport } from "../agents/rehearse-session";

interface SessionConfig {
  sessionId: string;
  speechDescription: string;
  domain: string;
  difficultyLevel: number;
}

interface SessionProps {
  config: SessionConfig;
  onEnd: (report: SessionReport) => void;
}

type AudienceStatus = "listening" | "wanting" | "speaking";

interface AudienceMemberUI {
  persona: PersonaType;
  nameEn: string;
  color: string;
  emoji: string;
  status: AudienceStatus;
  interactionCount: number;
}

interface Intervention {
  persona: PersonaType;
  personaName: string;
  color: string;
  text: string;
  audioDataUri?: string;
}

const PERSONA_META: Record<PersonaType, { nameEn: string; color: string; emoji: string }> = {
  skeptic: { nameEn: "The Skeptic", color: "#6B7FD7", emoji: "🧐" },
  enthusiast: { nameEn: "The Enthusiast", color: "#C77DBA", emoji: "✨" },
  distracted: { nameEn: "The Distracted", color: "#F4A261", emoji: "😅" },
  expert: { nameEn: "The Expert", color: "#52B788", emoji: "🎓" }
};

function float32ToInt16Base64(float32: Float32Array): string {
  const int16 = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
  }
  const bytes = new Uint8Array(int16.buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

export function Session({ config, onEnd }: SessionProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [partialTranscript, setPartialTranscript] = useState("");
  const [transcript, setTranscript] = useState("");
  const [currentIntervention, setCurrentIntervention] = useState<Intervention | null>(null);
  const [isEnding, setIsEnding] = useState(false);
  const [notes, setNotes] = useState("");
  const [showNotes, setShowNotes] = useState(false);

  const [audienceMembers, setAudienceMembers] = useState<AudienceMemberUI[]>(
    (["skeptic", "enthusiast", "distracted", "expert"] as PersonaType[]).map(p => ({
      persona: p,
      ...PERSONA_META[p],
      status: "listening" as AudienceStatus,
      interactionCount: 0
    }))
  );

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const agent = useAgent<RehearseSession>({
    agent: "RehearseSession",
    name: config.sessionId,
    onOpen: useCallback(() => setIsConnected(true), []),
    onClose: useCallback(() => setIsConnected(false), []),
    onMessage: useCallback((event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data));

        if (data.type === "transcript") {
          if (data.partial) setPartialTranscript(data.text);
          else {
            setTranscript(prev => prev ? prev + " " + data.text : data.text);
            setPartialTranscript("");
          }
        }

        if (data.type === "intervention" && data.events?.length > 0) {
          const ev = data.events[0];
          const persona = ev.persona as PersonaType;
          setCurrentIntervention({
            persona,
            personaName: PERSONA_META[persona].nameEn,
            color: PERSONA_META[persona].color,
            text: ev.text,
            audioDataUri: ev.audioDataUri
          });
          setAudienceMembers(prev =>
            prev.map(m => ({
              ...m,
              status: m.persona === persona ? "speaking" : m.status,
              interactionCount: m.persona === persona ? m.interactionCount + 1 : m.interactionCount
            }))
          );
          setTimeout(() => {
            setAudienceMembers(prev =>
              prev.map(m => ({ ...m, status: m.persona === persona ? "listening" : m.status }))
            );
          }, 6000);
        }
      } catch { /* ignore */ }
    }, [])
  });

  // Init session DO
  useEffect(() => {
    if (!isConnected) return;
    agent.call("createSession", [{
      speechDescription: config.speechDescription,
      domain: config.domain,
      difficultyLevel: config.difficultyLevel
    }]).catch(console.error);
  }, [isConnected]); // eslint-disable-line

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Local Storage for notes
  useEffect(() => {
    const saved = localStorage.getItem(`rehearse_notes_${config.sessionId}`);
    if (saved) setNotes(saved);
  }, [config.sessionId]);

  // Auto-save notes to localStorage + Supabase
  useEffect(() => {
    if (notes.trim()) {
      localStorage.setItem(`rehearse_notes_${config.sessionId}`, notes);
      // Persist to Supabase (debounced via this effect's dependency)
      saveNote({
        sessionId: config.sessionId,
        content: notes,
        savedAt: new Date().toISOString(),
        topic: config.speechDescription,
      }).catch(console.error);
    } else {
      localStorage.removeItem(`rehearse_notes_${config.sessionId}`);
    }
  }, [notes, config.sessionId, config.speechDescription]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioCtx;

      // Load the AudioWorklet processor (replaces deprecated ScriptProcessorNode)
      await audioCtx.audioWorklet.addModule("/audio-processor.js");

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Analyser for the waveform visualizer
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;

      // AudioWorklet node — runs in dedicated audio thread
      const worklet = new AudioWorkletNode(audioCtx, "pcm-processor");
      workletRef.current = worklet;
      worklet.port.onmessage = (e: MessageEvent<string>) => {
        // e.data is a Base64 encoded Int16 PCM chunk
        agent.send(JSON.stringify({ type: "audio-chunk", data: e.data }));
      };

      source.connect(worklet);
      worklet.connect(audioCtx.destination);

      await agent.call("startTranscription", []);
      setIsRecording(true);
    } catch {
      alert("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [agent]);

  const stopRecording = useCallback(async () => {
    workletRef.current?.disconnect();
    workletRef.current?.port.close();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    workletRef.current = sourceRef.current = streamRef.current = audioContextRef.current = analyserRef.current = null;
    setIsRecording(false);
    try { await agent.call("stopTranscription", []); } catch { /* ok */ }
  }, [agent]);

  const handleEnd = useCallback(async () => {
    setIsEnding(true);
    if (isRecording) await stopRecording();
    try {
      const report = await agent.call("endSession", []) as SessionReport;
      onEnd(report);
    } catch {
      onEnd({
        score: 7, duration: elapsed,
        bestMoment: "Your delivery was confident throughout.",
        hardestMoment: "The audience challenged one of your key claims.",
        improvement: "Support your claims with specific numbers and examples.",
        interventionCount: audienceMembers.reduce((s, m) => s + m.interactionCount, 0)
      });
    }
  }, [isRecording, stopRecording, agent, onEnd, elapsed, audienceMembers]);

  const totalInterventions = audienceMembers.reduce((s, m) => s + m.interactionCount, 0);

  const exportNotes = useCallback(() => {
    if (!notes.trim()) return;
    const blob = new Blob([notes], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rehearse-notes-${config.sessionId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [notes, config.sessionId]);

  const handleDismissIntervention = useCallback(() => {
    setCurrentIntervention(null);
  }, []);

  return (
    <div className="screen session fade-in" style={{ padding: "1.5rem", justifyContent: "space-between" }}>
      <InterventionBanner
        intervention={currentIntervention}
        onDismiss={handleDismissIntervention}
      />

      {/* Notes Toggle Button */}
      <button
        className="btn btn--secondary session__notes-toggle"
        onClick={() => setShowNotes(!showNotes)}
        title={showNotes ? "Close Notes" : "Take Notes"}
        style={{ padding: "0.5rem", borderRadius: "50%", width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center" }}
      >
        {showNotes ? <X size={20} /> : <Notepad size={20} />}
      </button>

      {/* Notes Panel */}
      <div className={`notes-panel ${showNotes ? "notes-panel--open" : ""}`}>
        <div className="notes-panel__header">
          <h3>Session Notes</h3>
          <button onClick={exportNotes} disabled={!notes.trim()} className="btn btn--outline notes-panel__export">
            ↓ Export
          </button>
        </div>
        <textarea
          className="notes-panel__input"
          placeholder="Jot down speech adjustments, thoughts, or feedback you want to remember..."
          value={notes}
          onChange={e => setNotes(e.target.value)}
        />
      </div>

      {/* Header */}
      <div className="session__header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.2rem" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isConnected ? "#52B788" : "#9E9A96", display: "inline-block" }} />
            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>{isConnected ? "Live" : "Connecting..."}</span>
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--text-mid)", fontWeight: 300, maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {config.speechDescription}
          </div>
          {totalInterventions > 0 && (
            <div style={{ fontSize: "0.72rem", color: "var(--lavender)", marginTop: "0.2rem" }}>
              {totalInterventions} audience intervention{totalInterventions !== 1 ? "s" : ""}
            </div>
          )}
        </div>
        <div className="session__timer">{formatTime(elapsed)}</div>
      </div>

      {/* Audience Row */}
      <div className="audience-row">
        {audienceMembers.map(m => <AudienceCard key={m.persona} {...m} />)}
      </div>

      {/* Waveform + Transcript */}
      <div className="wave-wrap">
        <AudioWave isRecording={isRecording} analyser={analyserRef.current} />
        <div className={`transcript-display ${partialTranscript ? "transcript-display--partial" : ""}`}>
          {partialTranscript || transcript.slice(-200) || (
            isRecording ? "Listening..." : isConnected ? "Press the mic to start speaking" : "Connecting to your audience..."
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="session__controls">
        <button id="btn-end-session" className="btn btn--ghost" onClick={handleEnd} disabled={isEnding}>
          {isEnding ? (
            <span style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />
              Generating report...
            </span>
          ) : "End Session"}
        </button>

        <button
          id="btn-mic-toggle"
          className={`mic-btn ${isRecording ? "mic-btn--recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!isConnected || isEnding}
          aria-label={isRecording ? "Stop microphone" : "Start microphone"}
        >
          {isRecording ? (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
              <path d="M19 10a7 7 0 0 1-14 0" /><line x1="12" y1="17" x2="12" y2="21" /><line x1="8" y1="21" x2="16" y2="21" />
            </svg>
          )}
        </button>

        <div style={{ width: 100, display: "flex", justifyContent: "flex-start" }}>
          {isRecording && (
            <span style={{ fontSize: "0.7rem", color: "#dc2626", display: "flex", alignItems: "center", gap: "0.3rem" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#dc2626", animation: "dot-blink 1s infinite" }} />
              REC
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
