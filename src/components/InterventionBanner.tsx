import { useEffect, useRef } from "react";
import type { PersonaType } from "../lib/personas";

interface Intervention {
  persona: PersonaType;
  personaName: string;
  color: string;
  text: string;
  audioDataUri?: string;
}

interface InterventionBannerProps {
  intervention: Intervention | null;
  onDismiss: () => void;
}

const PERSONA_EMOJIS: Record<PersonaType, string> = {
  skeptic: "🧐",
  enthusiast: "✨",
  distracted: "😅",
  expert: "🎓"
};

let sharedAudioCtx: AudioContext | null = null;
function getSharedAudioCtx() {
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContext();
  if (sharedAudioCtx.state === "suspended") sharedAudioCtx.resume();
  return sharedAudioCtx;
}

export function InterventionBanner({ intervention, onDismiss }: InterventionBannerProps) {
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!intervention) return;

    if (intervention.audioDataUri) {
      const playAudio = async () => {
        try {
          const ctx = getSharedAudioCtx();
          
          // Decode Base64 safely
          const base64Str = intervention.audioDataUri!.split(',')[1];
          const binaryString = atob(base64Str);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          const audioBuffer = await ctx.decodeAudioData(bytes.buffer);
          
          const source = ctx.createBufferSource();
          source.buffer = audioBuffer;
          source.connect(ctx.destination);
          audioSourceRef.current = source;
          
          source.onended = () => {
            timerRef.current = setTimeout(onDismiss, 1500);
          };
          source.start(0);
        } catch (e) {
          console.error('[InterventionBanner] Audio playback failed:', e);
          timerRef.current = setTimeout(onDismiss, 5000);
        }
      };
      playAudio();
    } else {
      timerRef.current = setTimeout(onDismiss, 5000);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (audioSourceRef.current) {
        try { audioSourceRef.current.stop(); } catch {}
        audioSourceRef.current.disconnect();
        audioSourceRef.current = null;
      }
    };
  }, [intervention, onDismiss]);

  const handleFeedback = (type: "addressed" | "skipped") => {
    // Clear auto-dismiss timer so the user has time to see their choice
    if (timerRef.current) clearTimeout(timerRef.current);
    // Could emit analytics here in the future
    console.log(`[intervention] ${type}:`, intervention?.text);
    setTimeout(onDismiss, 400);
  };

  return (
    <div
      id="intervention-banner"
      className={`intervention-banner ${intervention ? "intervention-banner--visible" : ""}`}
      role="alert"
    >
      {intervention && (
        <div className="intervention-banner__card">
          <div className="intervention-banner__avatar" style={{ background: `${intervention.color}22` }}>
            {PERSONA_EMOJIS[intervention.persona]}
          </div>
          <div className="intervention-banner__content" style={{ flex: 1 }}>
            <div className="intervention-banner__name" style={{ color: intervention.color }}>
              {intervention.personaName}
            </div>
            <div className="intervention-banner__text">{intervention.text}</div>

            {/* Feedback buttons */}
            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.6rem" }}>
              <button
                onClick={() => handleFeedback("addressed")}
                style={{
                  padding: "0.3rem 0.75rem", borderRadius: "100px", border: "1.5px solid #52B788",
                  background: "transparent", color: "#52B788", fontSize: "0.72rem",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 200ms ease",
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "#52B78822"; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; }}
              >
                ✓ Addressed
              </button>
              <button
                onClick={() => handleFeedback("skipped")}
                style={{
                  padding: "0.3rem 0.75rem", borderRadius: "100px", border: "1.5px solid var(--text-faint)",
                  background: "transparent", color: "var(--text-muted)", fontSize: "0.72rem",
                  cursor: "pointer", fontFamily: "inherit", transition: "all 200ms ease",
                }}
                onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = "var(--cream-deep)"; }}
                onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = "transparent"; }}
              >
                → Skip
              </button>
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "1.2rem", padding: "0 0.4rem", alignSelf: "flex-start" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

