import { useState, useEffect, useRef, useCallback } from "react";
import { Microphone, MicrophoneSlash, Chat, X } from "@phosphor-icons/react";
import { useSharedSession } from "../hooks/useSharedSession";
import { InterventionBanner } from "../components/InterventionBanner";
import type { PersonaType } from "../lib/personas";
import { PERSONAS } from "../lib/personas";

interface Props {
  roomCode: string;
  speechDescription: string;
  domain: string;
  difficultyLevel: number;
  onLeave: () => void;
}

const PERSONA_TYPES: PersonaType[] = ["skeptic", "enthusiast", "distracted", "expert"];

export function SharedRoom({ roomCode, speechDescription, domain, difficultyLevel, onLeave }: Props) {
  const participantId = useRef(crypto.randomUUID()).current;
  const [myName] = useState(() => localStorage.getItem("rehearse_name") ?? "You");
  const [recording, setRecording] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [activeIntervention, setActiveIntervention] = useState<null | {
    text: string; persona: PersonaType; personaName: string; color: string; audioDataUri?: string;
  }>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { status, roomState, interventions, chatMessages, sendTranscript, sendAudioChunk, sendChat } =
    useSharedSession(roomCode, participantId, myName);

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const [interventionQueue, setInterventionQueue] = useState<any[]>([]);
  const [processedCount, setProcessedCount] = useState(0);

  // Queue new interventions sequentially
  useEffect(() => {
    if (interventions.length > processedCount) {
      const newInterventions = interventions.slice(processedCount);
      setInterventionQueue(q => [...q, ...newInterventions]);
      setProcessedCount(interventions.length);
    }
  }, [interventions, processedCount]);

  // Process the queue one by one
  useEffect(() => {
    if (!activeIntervention && interventionQueue.length > 0) {
      const next = interventionQueue[0];
      setActiveIntervention({
        text: next.text,
        persona: next.persona,
        personaName: next.personaName,
        color: next.color,
        audioDataUri: next.audioDataUri
      });
      setInterventionQueue(q => q.slice(1));
    }
  }, [activeIntervention, interventionQueue]);

  const formatTime = (s: number) =>
    `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // Microphone recording via AudioWorklet
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = ctx;
      await ctx.audioWorklet.addModule("/audio-processor.js");
      const source = ctx.createMediaStreamSource(stream);
      const node = new AudioWorkletNode(ctx, "rehearse-audio-processor");
      workletNodeRef.current = node;
      source.connect(node);
      node.port.onmessage = (e) => {
        if (e.data.type === "pcm-chunk") {
          sendAudioChunk(e.data.base64);
        }
      };
      setRecording(true);
    } catch (e) {
      console.error("Mic error:", e);
    }
  }, [sendAudioChunk]);

  const stopRecording = useCallback(() => {
    workletNodeRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioCtxRef.current?.close();
    workletNodeRef.current = null;
    streamRef.current = null;
    audioCtxRef.current = null;
    setRecording(false);
  }, []);

  useEffect(() => () => { stopRecording(); }, [stopRecording]);

  const handleDismissIntervention = useCallback(() => {
    setActiveIntervention(null);
  }, []);

  return (
    <div className="session fade-in" style={{ position: "relative" }}>
      {/* Intervention banner */}
      <InterventionBanner
        intervention={activeIntervention}
        onDismiss={handleDismissIntervention}
      />

      {/* Header */}
      <div className="session__header">
        <div style={{ display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span className="session__timer">{formatTime(elapsed)}</span>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {roomState?.participants.length ?? 1} participant{(roomState?.participants.length ?? 1) !== 1 ? "s" : ""}
          </span>
        </div>

        {/* Room code badge */}
        <div style={{
          background: "var(--lavender-soft)", borderRadius: "var(--radius-sm)",
          padding: "0.4rem 1rem", textAlign: "center"
        }}>
          <div style={{ fontSize: "0.6rem", color: "var(--lavender)", letterSpacing: "0.08em" }}>ROOM</div>
          <div style={{ fontSize: "1.1rem", fontWeight: 600, letterSpacing: "0.2em", color: "var(--text-dark)", fontFamily: "monospace" }}>
            {roomCode}
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn btn--ghost"
            style={{ padding: "0.5rem 0.8rem", fontSize: "0.8rem" }}
            onClick={() => setShowChat(c => !c)}
          >
            <Chat size={18} />
          </button>
          <button className="btn btn--secondary" onClick={onLeave} style={{ padding: "0.5rem 1rem", fontSize: "0.8rem" }}>
            Leave
          </button>
        </div>
      </div>

      {/* Connection status */}
      {status !== "connected" && (
        <div style={{
          padding: "0.5rem 1rem", borderRadius: "var(--radius-sm)",
          background: status === "connecting" ? "var(--lavender-soft)" : "#fee2e2",
          fontSize: "0.8rem",
          color: status === "connecting" ? "var(--lavender)" : "#dc2626",
          marginBottom: "1rem", textAlign: "center", width: "100%"
        }}>
          {status === "connecting" ? "⏳ Connecting to room…" : "⚠️ Connection lost. Reconnecting…"}
        </div>
      )}

      {/* Topic */}
      <div style={{
        width: "100%", background: "#fff", borderRadius: "var(--radius-md)",
        padding: "0.8rem 1.2rem", marginBottom: "0.8rem",
        boxShadow: "var(--shadow-sm)", fontSize: "0.9rem", color: "var(--text-mid)"
      }}>
        🎤 <strong style={{ color: "var(--text-dark)" }}>{speechDescription}</strong>
        <span style={{ marginLeft: "0.8rem", fontSize: "0.75rem", color: "var(--text-muted)" }}>
          {domain} · Difficulty {difficultyLevel}/5
        </span>
      </div>

      {/* Participants */}
      {roomState && (
        <div style={{ display: "flex", gap: "0.6rem", width: "100%", marginBottom: "0.8rem", flexWrap: "wrap" }}>
          {roomState.participants.map(p => (
            <div key={p.participantId} style={{
              display: "flex", alignItems: "center", gap: "0.4rem",
              padding: "0.4rem 0.8rem", background: p.participantId === participantId ? "var(--lavender-soft)" : "var(--cream-deep)",
              borderRadius: "100px", fontSize: "0.78rem",
              color: p.participantId === participantId ? "var(--lavender)" : "var(--text-mid)"
            }}>
              <span>{p.participantId === participantId ? "🎤" : "👤"}</span>
              <span>{p.name}{p.participantId === participantId ? " (you)" : ""}</span>
            </div>
          ))}
        </div>
      )}

      {/* Audience row */}
      <div className="audience-row">
        {PERSONA_TYPES.map(persona => {
          const p = PERSONAS[persona];
          const recentIntervention = [...interventions].reverse().find(i => i.persona === persona);
          return (
            <div key={persona} className="audience-card">
              <div className="audience-card__avatar" style={{ background: `${p.color}22`, color: p.color, fontSize: "1.3rem" }}>
                {persona === "skeptic" ? "🧐" : persona === "enthusiast" ? "✨" : persona === "distracted" ? "😅" : "🎓"}
              </div>
              <div className="audience-card__name">{p.nameEn}</div>
              {recentIntervention && (
                <div className="audience-card__status" style={{ color: p.color, fontSize: "0.6rem" }}>
                  responded
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Interventions log */}
      {interventions.length > 0 && (
        <div style={{
          width: "100%", maxHeight: "160px", overflowY: "auto",
          display: "flex", flexDirection: "column", gap: "0.5rem",
          padding: "0.5rem 0", marginTop: "0.5rem"
        }}>
          {[...interventions].reverse().slice(0, 5).map((iv, i) => (
            <div key={i} style={{
              background: "#fff", borderRadius: "var(--radius-sm)",
              padding: "0.6rem 1rem", fontSize: "0.82rem",
              borderLeft: `3px solid ${iv.color}`,
              boxShadow: "var(--shadow-sm)"
            }}>
              <span style={{ color: iv.color, fontWeight: 500 }}>{iv.personaName}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.72rem", marginLeft: "0.4rem" }}>
                → {iv.triggeredByName}
              </span>
              <div style={{ color: "var(--text-dark)", marginTop: "0.2rem" }}>{iv.text}</div>
            </div>
          ))}
        </div>
      )}

      {/* Main mic control */}
      <div className="session__controls" style={{ marginTop: "auto" }}>
        <button
          className={`mic-btn ${recording ? "mic-btn--recording" : ""}`}
          onClick={recording ? stopRecording : startRecording}
          disabled={status !== "connected"}
          aria-label={recording ? "Stop speaking" : "Start speaking"}
        >
          {recording ? <MicrophoneSlash size={28} weight="fill" /> : <Microphone size={28} weight="fill" />}
        </button>
      </div>

      {/* Chat panel */}
      {showChat && (
        <div style={{
          position: "fixed", right: "1rem", bottom: "5rem",
          width: "300px", maxHeight: "400px",
          background: "#fff", borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-lift)", zIndex: 200,
          display: "flex", flexDirection: "column", padding: "1rem", gap: "0.8rem"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontWeight: 500, fontSize: "0.9rem" }}>Room Chat</span>
            <button onClick={() => setShowChat(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "0.4rem", minHeight: "100px" }}>
            {chatMessages.map((m, i) => (
              <div key={i} style={{ fontSize: "0.82rem" }}>
                <strong style={{ color: "var(--lavender)" }}>{m.from}:</strong>{" "}
                <span style={{ color: "var(--text-dark)" }}>{m.text}</span>
              </div>
            ))}
            {chatMessages.length === 0 && (
              <div style={{ color: "var(--text-muted)", fontSize: "0.8rem", textAlign: "center", marginTop: "1rem" }}>
                No messages yet
              </div>
            )}
          </div>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <input
              style={{ flex: 1, padding: "0.5rem 0.8rem", borderRadius: "var(--radius-sm)", border: "1.5px solid var(--cream-deep)", fontFamily: "inherit", fontSize: "0.85rem", outline: "none" }}
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Type a message…"
              onKeyDown={e => {
                if (e.key === "Enter" && chatInput.trim()) {
                  sendChat(chatInput.trim());
                  setChatInput("");
                }
              }}
            />
            <button
              className="btn btn--primary"
              style={{ padding: "0.5rem 0.8rem", fontSize: "0.8rem" }}
              onClick={() => { if (chatInput.trim()) { sendChat(chatInput.trim()); setChatInput(""); } }}
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
