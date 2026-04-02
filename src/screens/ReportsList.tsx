import { useState, useEffect } from "react";
import { getSessions, type SessionRecord } from "../lib/db";

const DIFFICULTY_LABELS = ["", "Very Easy", "Easy", "Balanced", "Hard", "Hostile"];
const DIFFICULTY_COLORS = ["", "#52B788", "#85C1A0", "var(--lavender)", "#F4A261", "#e74c3c"];

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? "#52B788" : score >= 6 ? "var(--lavender)" : "#F4A261";
  return (
    <div style={{
      width: 52, height: 52, borderRadius: "50%", flexShrink: 0,
      background: `${color}22`, color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: "1.3rem", fontWeight: 600,
    }}>
      {score}
    </div>
  );
}

function formatDuration(s: number) {
  if (!s) return "—";
  const m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export function ReportsList() {
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    getSessions()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="screen reports-list fade-in" style={{ padding: "2.5rem 2rem", alignItems: "flex-start", justifyContent: "flex-start", minHeight: "100vh" }}>
      <div style={{ width: "100%", marginBottom: "2rem" }}>
        <h1 className="screen-title" style={{ fontSize: "2rem" }}>Session History</h1>
        <p className="screen-subtitle">Your past performance — most recent first</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", color: "var(--text-muted)", padding: "2rem 0" }}>
          <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Loading history…
        </div>
      ) : (
        <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1rem" }}>
          {sessions.length === 0 ? (
            <div style={{ padding: "3rem", background: "#fff", borderRadius: "var(--radius-lg)", textAlign: "center", color: "var(--text-muted)", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>📊</div>
              No sessions yet. Complete a practice session to see your history here.
            </div>
          ) : (
            sessions.map((r, i) => (
              <div key={`${r.sessionId}-${i}`} className="moment-card" style={{ flexDirection: "row", alignItems: "flex-start", gap: "1.2rem" }}>
                <ScoreBadge score={r.score} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Topic */}
                  <div style={{ fontSize: "1rem", color: "var(--text-dark)", fontWeight: 500, marginBottom: "0.2rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.topic}
                  </div>

                  {/* Meta row */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.6rem", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
                    <span>{new Date(r.date).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</span>
                    {r.duration > 0 && <span>· {formatDuration(r.duration)}</span>}
                    {r.domain && <span>· {r.domain}</span>}
                    {r.difficultyLevel > 0 && (
                      <span style={{ color: DIFFICULTY_COLORS[r.difficultyLevel] }}>
                        · {DIFFICULTY_LABELS[r.difficultyLevel]}
                      </span>
                    )}
                    {r.interventionCount > 0 && (
                      <span>· {r.interventionCount} intervention{r.interventionCount !== 1 ? "s" : ""}</span>
                    )}
                  </div>

                  {/* Best moment */}
                  {r.bestMoment && (
                    <div style={{ fontSize: "0.85rem", color: "var(--text-mid)" }}>
                      ⭐ {r.bestMoment}
                    </div>
                  )}

                  {/* Improvement */}
                  {r.improvement && (
                    <div style={{ fontSize: "0.8rem", color: "var(--lavender)", marginTop: "0.3rem" }}>
                      → {r.improvement}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
