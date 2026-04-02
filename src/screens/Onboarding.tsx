import { useState } from "react";

interface OnboardingProps {
  onComplete: () => void;
}

const STEPS = [
  {
    emoji: "🎙️",
    title: "Speak, don't just\nprepare",
    desc: "Most people over-prepare silently. REHEARSE forces you to actually speak out loud — the only way to get better.",
    extra: null
  },
  {
    emoji: "🎭",
    title: "Meet your\naudience",
    desc: "4 independent AI audience members, each with their own personality. They listen, react, and interrupt just like a real crowd.",
    extra: "audience"
  },
  {
    emoji: "📊",
    title: "Get a score,\nnot just applause",
    desc: "After every session, receive an honest performance score, your best moment, your hardest challenge, and one thing to improve.",
    extra: "score"
  }
];

const AUDIENCE = [
  { color: "#6B7FD7", emoji: "🧐", name: "The Skeptic",    desc: "Demands sources and data" },
  { color: "#C77DBA", emoji: "✨", name: "The Enthusiast", desc: "Encourages when you stumble" },
  { color: "#F4A261", emoji: "😅", name: "The Distracted", desc: "Forces you to simplify" },
  { color: "#52B788", emoji: "🎓", name: "The Expert",     desc: "Corrects technical errors" }
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = () => {
    if (isLast) onComplete();
    else setStep((s) => s + 1);
  };

  const skip = () => onComplete();

  return (
    <div className="screen onboarding fade-in">
      {/* Step dots */}
      <div className="onboarding__steps">
        {STEPS.map((_, i) => (
          <div
            key={i}
            className={`onboarding__step-dot ${
              i === step
                ? "onboarding__step-dot--active"
                : i < step
                  ? "onboarding__step-dot--done"
                  : ""
            }`}
          />
        ))}
      </div>

      {/* Visual */}
      <div
        key={step}
        className="onboarding__visual fade-in"
      >
        {current.emoji}
      </div>

      {/* Text */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.8rem", alignItems: "center" }}>
        <h2
          className="onboarding__title"
          style={{ whiteSpace: "pre-line" }}
          id={`onboarding-title-${step}`}
        >
          {current.title}
        </h2>
        <p className="onboarding__desc">{current.desc}</p>
      </div>

      {/* Step 2 — audience grid */}
      {current.extra === "audience" && (
        <div className="onboarding__audience-preview">
          {AUDIENCE.map((m) => (
            <div key={m.name} className="onboarding__member">
              <div
                className="onboarding__avatar"
                style={{ background: `${m.color}22` }}
                title={m.desc}
              >
                {m.emoji}
              </div>
              <span className="onboarding__member-name">{m.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Step 3 — score preview */}
      {current.extra === "score" && (
        <div
          style={{
            background: "var(--lavender-soft)",
            borderRadius: "var(--radius-md)",
            padding: "1.2rem 2rem",
            display: "flex",
            gap: "2rem",
            alignItems: "center",
            justifyContent: "center"
          }}
        >
          {[
            { value: "8.4", label: "Performance Score" },
            { value: "3", label: "Interventions" },
            { value: "1", label: "Key Insight" }
          ].map((item) => (
            <div key={item.label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "1.8rem", fontWeight: 500, color: "var(--lavender)" }}>
                {item.value}
              </div>
              <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                {item.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Navigation */}
      <div className="onboarding__nav">
        <button
          id="btn-onboarding-skip"
          className="btn btn--ghost"
          onClick={skip}
          style={{ fontSize: "0.85rem" }}
        >
          Skip
        </button>

        <button
          id={isLast ? "btn-onboarding-finish" : "btn-onboarding-next"}
          className="btn btn--primary"
          onClick={next}
          style={{ minWidth: 140 }}
        >
          {isLast ? "Start Practicing →" : "Next →"}
        </button>
      </div>
    </div>
  );
}
