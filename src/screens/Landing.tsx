interface LandingProps {
  onStart: () => void;
  onDashboard: () => void;
  userName?: string;
}

export function Landing({ onStart, onDashboard }: LandingProps) {
  return (
    <div
      className="screen landing fade-in"
      style={{
        justifyContent: "center",
        alignItems: "center",
        gap: "1.4rem",
        padding: "2rem",
        height: "100%",
        textAlign: "center",
      }}
    >
      {/* Mic icon — compact */}
      <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        {/* Pulse rings */}
        {[0, 1].map((i) => (
          <span
            key={i}
            style={{
              position: "absolute",
              width: 60 + i * 28,
              height: 60 + i * 28,
              borderRadius: "50%",
              border: "1.5px solid var(--lavender)",
              opacity: 0.2 - i * 0.07,
              animation: `ring-pulse 3s ease-in-out ${i * 1}s infinite`,
            }}
          />
        ))}
        {/* Icon circle */}
        <div
          style={{
            width: 60,
            height: 60,
            borderRadius: "50%",
            background: "var(--lavender-soft)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
            zIndex: 1,
          }}
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="var(--lavender)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4z" />
            <path d="M19 10a7 7 0 0 1-14 0" />
            <line x1="12" y1="17" x2="12" y2="21" />
            <line x1="8" y1="21" x2="16" y2="21" />
          </svg>
        </div>
      </div>

      {/* Title */}
      <h1
        id="landing-title"
        style={{
          fontSize: "clamp(2rem, 4.5vw, 3.2rem)",
          fontWeight: 200,
          color: "var(--text-dark)",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
          margin: 0,
        }}
      >
        Empty stage.
        <br />
        Live audience.
        <br />
        <span style={{ color: "var(--lavender)" }}>Just you.</span>
      </h1>

      {/* Subtitle */}
      <p
        style={{
          fontSize: "0.95rem",
          fontWeight: 300,
          color: "var(--text-muted)",
          maxWidth: 360,
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        Practice in front of 4 independent AI audience members who interrupt,
        question, and challenge you — in real time.
      </p>

      {/* Audience avatars */}
      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", justifyContent: "center" }}>
        {[
          { color: "#6B7FD7", emoji: "🧐" },
          { color: "#C77DBA", emoji: "✨" },
          { color: "#F4A261", emoji: "😅" },
          { color: "#52B788", emoji: "🎓" },
        ].map((p, i) => (
          <div
            key={i}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: `${p.color}22`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.95rem",
            }}
          >
            {p.emoji}
          </div>
        ))}
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginLeft: "0.3rem" }}>
          4 AI audience members
        </span>
      </div>

      {/* CTAs */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.6rem" }}>
        <button
          id="btn-start-training"
          className="btn btn--primary"
          onClick={onStart}
          style={{ padding: "0.95rem 2.4rem", fontSize: "1rem" }}
        >
          Start Practicing →
        </button>

        <button
          id="btn-view-dashboard"
          className="btn btn--ghost"
          onClick={onDashboard}
          style={{ fontSize: "0.85rem", padding: "0.5rem 1rem" }}
        >
          Judge's Dashboard
        </button>
      </div>
    </div>
  );
}
