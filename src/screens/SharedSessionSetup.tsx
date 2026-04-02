import { useState } from "react";

interface Props {
  onRoomCreated: (roomCode: string, config: { speechDescription: string; domain: string; difficultyLevel: number }) => void;
  onJoin: () => void;
}

const DOMAINS = ["technology", "business", "science", "education", "health", "social", "general"];
const DIFFICULTY_LABELS = ["", "Very Easy", "Easy", "Balanced", "Hard", "Hostile"];
const DIFFICULTY_COLORS = ["", "#52B788", "#85C1A0", "var(--lavender)", "#F4A261", "#e74c3c"];

export function SharedSessionSetup({ onRoomCreated, onJoin }: Props) {
  const [tab,               setTab]               = useState<"create" | "join">("create");
  const [speechDescription, setSpeechDescription] = useState("");
  const [domain,            setDomain]            = useState("general");
  const [difficultyLevel,   setDifficultyLevel]   = useState(3);
  const [hostName,          setHostName]           = useState("");
  const [joinCode,          setJoinCode]           = useState("");
  const [loading,           setLoading]            = useState(false);
  const [error,             setError]              = useState("");
  const [createdCode,       setCreatedCode]        = useState<string | null>(null);

  const handleCreate = async () => {
    if (!speechDescription.trim()) { setError("Please enter a topic."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/rooms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speechDescription, domain, difficultyLevel, hostName: hostName || "Host" })
      });
      const data = await res.json() as { roomCode?: string; error?: string };
      if (!res.ok || !data.roomCode) throw new Error(data.error ?? "Failed to create room");
      setCreatedCode(data.roomCode);
      onRoomCreated(data.roomCode, { speechDescription, domain, difficultyLevel });
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (joinCode.length !== 6) { setError("Room code must be 6 characters."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/rooms/${joinCode.toUpperCase()}`);
      if (!res.ok) throw new Error("Room not found");
      const data = await res.json() as { speechDescription: string; domain: string; difficultyLevel: number };
      onRoomCreated(joinCode.toUpperCase(), data);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="screen setup fade-in" style={{ alignItems: "center", justifyContent: "flex-start", paddingTop: "3rem" }}>
      <div style={{ width: "100%", maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div className="setup__header">
          <h1 className="screen-title">Shared Session</h1>
          <p className="screen-subtitle">Practice together — two speakers, one audience</p>
          <div className="divider" style={{ margin: "1.2rem auto" }} />
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "0.5rem", background: "var(--cream-deep)", borderRadius: "var(--radius-sm)", padding: "0.3rem", marginBottom: "1.5rem" }}>
          {(["create", "join"] as const).map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(""); }}
              style={{
                flex: 1, padding: "0.65rem", borderRadius: "var(--radius-sm)",
                border: "none", cursor: "pointer", fontFamily: "inherit", fontSize: "0.9rem",
                background: tab === t ? "#fff" : "transparent",
                color: tab === t ? "var(--text-dark)" : "var(--text-muted)",
                boxShadow: tab === t ? "var(--shadow-sm)" : "none",
                fontWeight: tab === t ? 500 : 400,
                transition: "all 200ms ease"
              }}
            >
              {t === "create" ? "🎤 Create Room" : "🔗 Join Room"}
            </button>
          ))}
        </div>

        {/* Create Tab */}
        {tab === "create" && (
          <div className="setup__card">
            <div className="field">
              <label className="field__label">Your Name</label>
              <input
                className="field__input"
                value={hostName}
                onChange={e => setHostName(e.target.value)}
                placeholder="e.g. Alex"
                maxLength={50}
              />
            </div>

            <div className="field">
              <label className="field__label">Speech Topic</label>
              <input
                className="field__input"
                value={speechDescription}
                onChange={e => setSpeechDescription(e.target.value)}
                placeholder="e.g. Why renewable energy is the future"
                maxLength={300}
              />
            </div>

            <div className="field">
              <label className="field__label">Domain</label>
              <select className="field__select" value={domain} onChange={e => setDomain(e.target.value)}>
                {DOMAINS.map(d => <option key={d} value={d}>{d.charAt(0).toUpperCase() + d.slice(1)}</option>)}
              </select>
            </div>

            <div className="field difficulty-slider-wrap">
              <label className="field__label">
                Difficulty — <span style={{ color: DIFFICULTY_COLORS[difficultyLevel] }}>{DIFFICULTY_LABELS[difficultyLevel]}</span>
              </label>
              <input className="slider" type="range" min={1} max={5} value={difficultyLevel} onChange={e => setDifficultyLevel(Number(e.target.value))} />
              <div className="difficulty-labels">
                <span>Gentle</span><span>Hostile</span>
              </div>
            </div>

            {createdCode && (
              <div style={{
                background: "var(--lavender-soft)", borderRadius: "var(--radius-md)",
                padding: "1.2rem", textAlign: "center"
              }}>
                <div style={{ fontSize: "0.8rem", color: "var(--lavender)", marginBottom: "0.4rem" }}>Room Code — Share with your partner</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 600, letterSpacing: "0.25em", color: "var(--text-dark)", fontFamily: "monospace" }}>
                  {createdCode}
                </div>
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}?room=${createdCode}`)}
                  style={{ marginTop: "0.8rem", fontSize: "0.78rem", color: "var(--lavender)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}
                >
                  Copy invite link
                </button>
              </div>
            )}

            {error && <div style={{ color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>}

            <button className="btn btn--primary" onClick={createdCode ? onJoin : handleCreate} disabled={loading}>
              {loading ? "Creating…" : createdCode ? "Enter Room →" : "Create Room"}
            </button>
          </div>
        )}

        {/* Join Tab */}
        {tab === "join" && (
          <div className="setup__card">
            <div className="field">
              <label className="field__label">Room Code</label>
              <input
                className="field__input"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                placeholder="ABC123"
                maxLength={6}
                style={{ letterSpacing: "0.2em", fontSize: "1.4rem", fontFamily: "monospace", textAlign: "center" }}
              />
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: "0.85rem" }}>{error}</div>}

            <button className="btn btn--primary" onClick={handleJoin} disabled={loading || joinCode.length !== 6}>
              {loading ? "Joining…" : "Join Room →"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
