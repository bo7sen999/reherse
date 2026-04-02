interface LoginProps {
  onGuestLogin: () => void;
}

export function Login({ onGuestLogin }: LoginProps) {
  return (
    <div className="screen login fade-in">
      {/* Logo */}
      <div className="login__logo">
        <div className="login__logo-dot" />
        REHEARSE
        <div className="login__logo-dot" />
      </div>

      {/* Hero */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", alignItems: "center" }}>
        <h1 className="login__title" id="login-title">
          <span className="title-word" style={{ display: "inline-block", animationDelay: "0ms" }}>Practice</span>{' '}
          <span className="title-word" style={{ display: "inline-block", animationDelay: "150ms" }}>until</span><br />
          <span className="title-word" style={{ display: "inline-block", animationDelay: "300ms" }}>it</span>{' '}
          <span className="title-word" style={{ display: "inline-block", animationDelay: "450ms" }}>feels</span>{' '}
          <span className="title-word" style={{ display: "inline-block", animationDelay: "600ms", color: "var(--lavender)" }}>effortless</span>
        </h1>
        <p className="login__tagline">
          Speak in front of 4 AI audience members who interrupt, question, and challenge you — live.
        </p>
      </div>

      {/* Audience preview */}
      <div style={{ display: "flex", gap: "0.8rem", alignItems: "center", justifyContent: "center" }}>
        {[
          { color: "#6B7FD7", emoji: "🧐", label: "The Skeptic" },
          { color: "#C77DBA", emoji: "✨", label: "The Enthusiast" },
          { color: "#F4A261", emoji: "😅", label: "The Distracted" },
          { color: "#52B788", emoji: "🎓", label: "The Expert" }
        ].map((p) => (
          <div
            key={p.label}
            title={p.label}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: `${p.color}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.1rem"
            }}
          >
            {p.emoji}
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <div style={{ marginTop: "1rem" }}>
        <button
          id="btn-continue-primary"
          className="btn btn--primary"
          onClick={onGuestLogin}
          style={{ padding: "1.2rem 3rem", fontSize: "1.1rem", borderRadius: "100px" }}
        >
          Get Started →
        </button>
      </div>
    </div>
  );
}
