import { useState, useEffect } from "react";

interface DashboardProps {
  onBack: () => void;
}

const ACTIVE_DOTS = [
  { x: 45, y: 18, size: 6 }, { x: 62, y: 28, size: 8 }, { x: 25, y: 65, size: 5 },
  { x: 75, y: 50, size: 7 }, { x: 50, y: 42, size: 6 }, { x: 85, y: 30, size: 5 },
  { x: 33, y: 38, size: 4 }
];

const GLOBE_POINTS = [
  {x:15,y:30},{x:22,y:25},{x:30,y:20},{x:45,y:18},{x:55,y:22},{x:62,y:28},
  {x:70,y:32},{x:78,y:30},{x:85,y:35},{x:20,y:45},{x:28,y:50},{x:35,y:55},
  {x:48,y:42},{x:58,y:48},{x:65,y:45},{x:75,y:50},{x:82,y:55},{x:88,y:48},
  {x:25,y:65},{x:38,y:68},{x:50,y:62},{x:60,y:70},{x:72,y:65},{x:80,y:70}
];

function AnimatedCounter({ target }: { target: number }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let cur = 0;
    const step = Math.ceil(target / 30);
    const iv = setInterval(() => {
      cur = Math.min(cur + step, target);
      setValue(cur);
      if (cur >= target) clearInterval(iv);
    }, 40);
    return () => clearInterval(iv);
  }, [target]);
  return <span>{value}</span>;
}

export function Dashboard({ onBack }: DashboardProps) {
  const [data, setData] = useState({ totalSessions: 0, personasPerSession: 4 });

  useEffect(() => {
    fetch("/api/dashboard")
      .then(r => r.json())
      .then((d: unknown) => {
        const obj = d as { totalSessions?: number; personasPerSession?: number };
        setData({
          totalSessions:     obj.totalSessions     ?? 0,
          personasPerSession: obj.personasPerSession ?? 4,
        });
      })
      .catch(() => setData({ totalSessions: 0, personasPerSession: 4 }));
  }, []);

  return (
    <div className="screen dashboard fade-in">
      <div className="nav-back">
        <button id="btn-back-from-dashboard" className="btn btn--ghost" onClick={onBack}>← Back</button>
      </div>

      <div>
        <div className="landing__badge" style={{ marginBottom: "1rem", display: "inline-flex" }}>
          🌍 Judge's Dashboard
        </div>
        <h1 className="screen-title">The Edge is live</h1>
        <p className="screen-subtitle">Active rehearsal sessions worldwide</p>
      </div>

      {/* Globe SVG */}
      <div style={{ maxWidth: 600, width: "100%" }}>
        <svg viewBox="0 0 100 80" style={{ width: "100%", background: "var(--lavender-soft)", borderRadius: "var(--radius-lg)", padding: "0.5rem" }}>
          {[20,40,60].map(y => <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="rgba(155,142,196,0.15)" strokeWidth="0.4" />)}
          {[25,50,75].map(x => <line key={x} x1={x} y1="0" x2={x} y2="80" stroke="rgba(155,142,196,0.15)" strokeWidth="0.4" />)}
          {GLOBE_POINTS.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="0.8" fill="rgba(155,142,196,0.25)" />)}
          {ACTIVE_DOTS.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r={p.size} fill="none" stroke="rgba(155,142,196,0.3)" strokeWidth="0.5">
                <animate attributeName="r" values={`${p.size};${p.size+4};${p.size}`} dur="2s" repeatCount="indefinite" begin={`${i*0.4}s`} />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" begin={`${i*0.4}s`} />
              </circle>
              <circle cx={p.x} cy={p.y} r="1.8" fill="var(--lavender)" opacity="0.8" />
            </g>
          ))}
        </svg>
      </div>

      {/* Counters */}
      <div className="dashboard__counter">
        <div className="counter-item">
          <div className="counter-item__value"><AnimatedCounter target={data.totalSessions} /></div>
          <div className="counter-item__label">Total Sessions</div>
        </div>
        <div style={{ width: 1, background: "var(--cream-deep)", alignSelf: "stretch" }} />
        <div className="counter-item">
          <div className="counter-item__value" style={{ fontSize: "1.8rem" }}>
            {data.totalSessions * data.personasPerSession || "—"}
          </div>
          <div className="counter-item__label">Total Audience Interactions</div>
        </div>
        <div style={{ width: 1, background: "var(--cream-deep)", alignSelf: "stretch" }} />
        <div className="counter-item">
          <div className="counter-item__value" style={{ fontSize: "1.8rem" }}>4</div>
          <div className="counter-item__label">Personas per session</div>
        </div>
      </div>

      {/* Architecture explainer */}
      <div style={{ background: "#fff", borderRadius: "var(--radius-lg)", padding: "1.8rem", maxWidth: 500, width: "100%", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", gap: "1rem" }}>
        <div style={{ fontSize: "0.75rem", color: "var(--lavender)", letterSpacing: "0.05em" }}>THE ARCHITECTURE</div>
        {[
          { icon: "🧐", label: "The Skeptic",    detail: "Independent Durable Object on the edge" },
          { icon: "✨", label: "The Enthusiast", detail: "SQLite memory + DO-to-DO communication" },
          { icon: "😅", label: "The Distracted", detail: "Workers AI real-time speech analysis" },
          { icon: "🎓", label: "The Expert",     detail: "ElevenLabs TTS with unique voice design" }
        ].map(item => (
          <div key={item.label} style={{ display: "flex", alignItems: "center", gap: "0.8rem", padding: "0.6rem 0", borderBottom: "1px solid var(--cream-deep)" }}>
            <span style={{ fontSize: "1.2rem" }}>{item.icon}</span>
            <div>
              <div style={{ fontSize: "0.85rem", color: "var(--text-dark)", fontWeight: 400 }}>{item.label}</div>
              <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>{item.detail}</div>
            </div>
          </div>
        ))}
      </div>

      <p className="dashboard__message">Every audience member is a live Durable Object.</p>
    </div>
  );
}
