import type { PersonaType } from "../lib/personas";

interface AudienceCardProps {
  persona: PersonaType;
  nameEn: string;
  color: string;
  emoji: string;
  status: "listening" | "wanting" | "speaking";
  interactionCount: number;
}

export function AudienceCard({ persona, nameEn, color, emoji, status, interactionCount }: AudienceCardProps) {
  const statusLabel =
    status === "speaking" ? "Speaking now" :
      status === "wanting" ? "Wants to speak" :
        "Listening";

  return (
    <div
      id={`audience-card-${persona}`}
      className={`audience-card stagger-in ${status === "wanting" ? "audience-card--wanting" : ""} ${status === "speaking" ? "audience-card--speaking" : ""}`}
    >
      <div className="audience-card__avatar" style={{ background: `${color}22` }}>
        <span>{emoji}</span>
        {status === "wanting" && <span className="audience-card__dot" />}
      </div>
      <span className="audience-card__name">{nameEn}</span>
      <span className="audience-card__status" style={{ color: status === "speaking" ? color : undefined }}>
        {statusLabel}
      </span>
      {interactionCount > 0 && (
        <span style={{ fontSize: "0.65rem", color, background: `${color}18`, borderRadius: "100px", padding: "0.15rem 0.5rem" }}>
          {interactionCount}×
        </span>
      )}
    </div>
  );
}
