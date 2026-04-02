import { useState } from "react";
import { PersonaSelector } from "../components/PersonaSelector";
import type { CustomPersonaData } from "../lib/personas";

const DOMAINS = [
  { value: "technology", label: "Technology & Innovation" },
  { value: "business",   label: "Business & Entrepreneurship" },
  { value: "science",    label: "Science & Research" },
  { value: "education",  label: "Education" },
  { value: "health",     label: "Health & Medicine" },
  { value: "social",     label: "Social Impact" },
  { value: "general",    label: "General" }
];

const AUDIENCE_MEMBERS = [
  { id: "skeptic",    emoji: "🧐", color: "#6B7FD7", name: "The Skeptic",    desc: "Questions your data, sources, and logic" },
  { id: "enthusiast", emoji: "✨", color: "#C77DBA", name: "The Enthusiast", desc: "Encourages you when you hesitate" },
  { id: "distracted", emoji: "😅", color: "#F4A261", name: "The Distracted", desc: "Asks simple questions when things get complex" },
  { id: "expert",     emoji: "🎓", color: "#52B788", name: "The Expert",     desc: "Corrects technical inaccuracies gently" }
];

interface SetupProps {
  onBack: () => void;
  onStartSession: (config: { speechDescription: string; domain: string; difficultyLevel: number; customPersonas?: CustomPersonaData[] }) => void;
  loading?: boolean;
}

export function Setup({ onBack, onStartSession, loading }: SetupProps) {
  const [speechDescription, setSpeechDescription] = useState("");
  const [domain,            setDomain]            = useState("general");
  const [difficultyLevel,   setDifficultyLevel]   = useState(3);
  const [customPersonas,    setCustomPersonas]    = useState<CustomPersonaData[] | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!speechDescription.trim()) return;
    onStartSession({ speechDescription, domain, difficultyLevel, ...(customPersonas ? { customPersonas } : {}) });
  };

  const difficultyLabels = ["", "Very Easy", "Easy", "Balanced", "Hard", "Hostile"];
  const difficultyColors  = ["", "#52B788", "#85C1A0", "var(--lavender)", "#F4A261", "#e74c3c"];

  return (
    <div
      className="screen fade-in"
      style={{ justifyContent: "center", alignItems: "center", padding: "1.5rem 2rem", height: "100%" }}
    >
      {/* Back */}
      <div className="nav-back">
        <button id="btn-back-to-landing" className="btn btn--ghost" onClick={onBack}>
          ← Back
        </button>
      </div>

      {/* Compact header */}
      <div style={{ textAlign: "center", marginBottom: "1.2rem" }}>
        <h1 className="screen-title" style={{ fontSize: "1.8rem" }}>Set up your session</h1>
        <p className="screen-subtitle" style={{ fontSize: "0.9rem", marginTop: "0.3rem" }}>Tell us about your speech</p>
      </div>

      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: "520px" }}>
        <div
          className="setup__card"
          style={{ gap: "1.2rem", padding: "1.8rem" }}
        >
          {/* Speech Description */}
          <div className="field" style={{ gap: "0.4rem" }}>
            <label className="field__label" htmlFor="speech-description">What is your speech about?</label>
            <input
              id="speech-description"
              className="field__input"
              type="text"
              placeholder="e.g. An AI system for early disease detection"
              value={speechDescription}
              onChange={(e) => setSpeechDescription(e.target.value)}
              required
              maxLength={200}
              style={{ padding: "0.75rem 1rem" }}
            />
          </div>

          {/* Domain + Difficulty — side by side */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
            <div className="field" style={{ gap: "0.4rem" }}>
              <label className="field__label" htmlFor="domain-select">Domain</label>
              <select
                id="domain-select"
                className="field__select"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                style={{ padding: "0.75rem 1rem" }}
              >
                {DOMAINS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ gap: "0.4rem" }}>
              <label className="field__label">
                Difficulty —
                <strong style={{ color: difficultyColors[difficultyLevel], marginLeft: "0.3rem" }}>
                  {difficultyLabels[difficultyLevel]}
                </strong>
              </label>
              <input
                id="difficulty-slider"
                type="range"
                className="slider"
                min={1} max={5} step={1}
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(Number(e.target.value))}
                style={{ marginTop: "0.6rem" }}
              />
              <div className="difficulty-labels" style={{ marginTop: "-0.2rem" }}>
                <span>Easy</span>
                <span>Hostile</span>
              </div>
            </div>
          </div>

          {/* Custom Persona Selector */}
          <PersonaSelector onSelect={setCustomPersonas} selectedCount={4} />

          {/* Audience Preview — compact row (shown when using default) */}
          {!customPersonas && (
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", justifyContent: "center", padding: "0.5rem 0" }}>
              <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginRight: "0.4rem" }}>Default audience:</span>
              {AUDIENCE_MEMBERS.map((m) => (
                <div
                  key={m.id}
                  title={`${m.name} — ${m.desc}`}
                  style={{ width: 36, height: 36, borderRadius: "50%", background: `${m.color}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", cursor: "default", transition: "transform 200ms ease" }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
                >
                  {m.emoji}
                </div>
              ))}
            </div>
          )}
          {customPersonas && (
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", padding: "0.4rem 0" }}>
              {customPersonas.map(p => (
                <div key={p.id} style={{ padding: "0.25rem 0.7rem", background: "var(--lavender-soft)", borderRadius: "100px", fontSize: "0.75rem", color: "var(--lavender)" }}>
                  {p.displayName}
                </div>
              ))}
            </div>
          )}

          {/* Submit */}
          <button
            id="btn-enter-stage"
            type="submit"
            className="btn btn--primary"
            disabled={loading || !speechDescription.trim()}
            style={{ width: "100%", padding: "0.9rem", fontSize: "0.95rem" }}
          >
            {loading ? (
              <span style={{ display: "flex", alignItems: "center", gap: "0.7rem", justifyContent: "center" }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                Gathering your audience...
              </span>
            ) : "🎭 Enter the Stage"}
          </button>
        </div>
      </form>
    </div>
  );
}
