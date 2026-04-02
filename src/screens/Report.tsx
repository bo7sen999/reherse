import { useEffect, useRef, useState } from "react";
import type { SessionReport } from "../agents/rehearse-session";

interface ReportProps {
  report: SessionReport;
  onNewSession: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const [animated, setAnimated] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setAnimated((score / 10) * circumference), 100);
    return () => clearTimeout(t);
  }, [score, circumference]);

  return (
    <div className="score-ring">
      <svg width="120" height="120" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="rgba(155,142,196,0.15)" strokeWidth="8" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--lavender)" strokeWidth="8"
          strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={circumference - animated}
          style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)" }} />
      </svg>
      <div className="score-ring__value">{score}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m} min ${s}s` : `${s} seconds`;
}

export function Report({ report, onNewSession }: ReportProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [audioPlaying, setAudioPlaying] = useState(false);

  const playReport = () => {
    if (!report.reportAudioUri) return;
    if (audioRef.current) audioRef.current.pause();
    const audio = new Audio(report.reportAudioUri);
    audioRef.current = audio;
    audio.onplay  = () => setAudioPlaying(true);
    audio.onended = () => setAudioPlaying(false);
    audio.onpause = () => setAudioPlaying(false);
    audio.play().catch(console.error);
  };

  const scoreLabel =
    report.score >= 9 ? "Outstanding 🌟" :
    report.score >= 7 ? "Great job ✨"   :
    report.score >= 5 ? "Good effort 👍" :
    "Keep practicing 💪";

  return (
    <div className="screen report fade-in" style={{ justifyContent: "center", paddingTop: "4rem", paddingBottom: "4rem" }}>
      <div className="report__header">
        <h1 className="screen-title">Session complete</h1>
        <p className="screen-subtitle">
          {formatDuration(report.duration)} · {report.interventionCount} audience intervention{report.interventionCount !== 1 ? "s" : ""}
        </p>
        <div className="divider" style={{ marginTop: "1rem" }} />
      </div>

      {/* Score */}
      <div className="score-card slide-up">
        <ScoreRing score={report.score} />
        <div className="score-ring__label">{scoreLabel}</div>
        {report.reportAudioUri && (
          <button id="btn-play-report-audio" className="btn btn--secondary" onClick={playReport}
            style={{ marginTop: "0.5rem", fontSize: "0.85rem" }}>
            {audioPlaying ? "🔊 Playing report..." : "▶ Listen to Report"}
          </button>
        )}
      </div>

      {/* Moments */}
      <div className="moment-card slide-up" style={{ animationDelay: "100ms" }}>
        <div className="moment-item">
          <div className="moment-item__icon moment-item__icon--best">⭐</div>
          <div>
            <div className="moment-item__label">Best moment</div>
            <div className="moment-item__text">{report.bestMoment}</div>
          </div>
        </div>
        <div style={{ height: "1px", background: "var(--cream-deep)", margin: "0.5rem 0" }} />
        <div className="moment-item">
          <div className="moment-item__icon moment-item__icon--hard">🎯</div>
          <div>
            <div className="moment-item__label">Hardest moment</div>
            <div className="moment-item__text">{report.hardestMoment}</div>
          </div>
        </div>
      </div>

      {/* Improvement */}
      <div className="improvement-card slide-up" style={{ animationDelay: "200ms" }}>
        <div className="improvement-card__label">ONE THING TO IMPROVE</div>
        <div className="improvement-card__text">{report.improvement}</div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
        <button id="btn-new-session" className="btn btn--primary" onClick={onNewSession}>
          Practice Again →
        </button>
      </div>
    </div>
  );
}
