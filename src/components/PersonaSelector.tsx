/**
 * PersonaSelector — Pick from 10 preset famous personas or generate a new one.
 * Shown as a collapsible section inside the Setup screen.
 *
 * Returns the selected persona IDs (array of up to 4) or null (= use default 4 audience types).
 */

import { useState, useEffect } from "react";
import type { CustomPersonaData } from "../lib/personas";
import { normalizePersonaId } from "../lib/personas";

interface Props {
  onSelect: (personas: CustomPersonaData[] | null) => void;
  selectedCount?: number; // max selectable
}

export function PersonaSelector({ onSelect, selectedCount = 4 }: Props) {
  const [open,      setOpen]      = useState(false);
  const [personas,  setPersonas]  = useState<CustomPersonaData[]>([]);
  const [selected,  setSelected]  = useState<Set<string>>(new Set());
  const [loading,   setLoading]   = useState(false);
  const [genName,   setGenName]   = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [genError,  setGenError]  = useState("");
  const [usingDefault, setUsingDefault] = useState(true);

  useEffect(() => {
    if (!open || personas.length > 0) return;
    setLoading(true);
    fetch("/api/personas")
      .then(r => r.json())
      .then((data: unknown) => {
        const list = Array.isArray(data) ? (data as CustomPersonaData[]) : [];
        list.sort((a, b) => (a.isPreset === b.isPreset ? a.displayName.localeCompare(b.displayName) : a.isPreset ? -1 : 1));
        setPersonas(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [open, personas.length]);

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < selectedCount) {
        next.add(id);
      }
      return next;
    });
    setUsingDefault(false);
  };

  const handleApply = () => {
    if (usingDefault || selected.size === 0) {
      onSelect(null);
    } else {
      const chosen = personas.filter(p => selected.has(p.id));
      onSelect(chosen);
    }
    setOpen(false);
  };

  const handleReset = () => {
    setSelected(new Set());
    setUsingDefault(true);
    onSelect(null);
    setOpen(false);
  };

  const handleGenerate = async () => {
    if (!genName.trim()) return;
    setGenLoading(true);
    setGenError("");
    try {
      const res  = await fetch("/api/personas/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: genName.trim() })
      });
      const data = await res.json() as CustomPersonaData | { error: string };
      if ("error" in data) {
        setGenError(data.error);
      } else {
        setPersonas(prev => [data, ...prev.filter(p => p.id !== data.id)]);
        setSelected(prev => { const n = new Set(prev); n.add(data.id); return n; });
        setGenName("");
        setUsingDefault(false);
      }
    } catch {
      setGenError("Network error. Please try again.");
    } finally {
      setGenLoading(false);
    }
  };

  return (
    <div style={{ width: "100%" }}>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: "100%", padding: "0.85rem 1.1rem",
          background: usingDefault ? "var(--cream)" : "var(--lavender-soft)",
          border: `1.5px solid ${usingDefault ? "transparent" : "var(--lavender)"}`,
          borderRadius: "var(--radius-sm)", cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontFamily: "inherit", fontSize: "0.9rem",
          color: usingDefault ? "var(--text-mid)" : "var(--lavender)",
          transition: "all 200ms ease"
        }}
      >
        <span>
          {usingDefault
            ? "🎭 Audience — Default (4 types)"
            : `🎭 Custom audience: ${selected.size} persona${selected.size !== 1 ? "s" : ""} selected`}
        </span>
        <span style={{ fontSize: "0.7rem", opacity: 0.6 }}>{open ? "▲" : "▼"}</span>
      </button>

      {/* Panel */}
      {open && (
        <div style={{
          background: "#fff", borderRadius: "var(--radius-md)",
          border: "1.5px solid var(--cream-deep)",
          boxShadow: "var(--shadow-card)",
          padding: "1.2rem", marginTop: "0.5rem",
          display: "flex", flexDirection: "column", gap: "1rem"
        }}>
          {/* Generate new persona */}
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--lavender)", letterSpacing: "0.05em", marginBottom: "0.5rem" }}>
              ADD NEW PERSONA
            </div>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <input
                style={{
                  flex: 1, padding: "0.6rem 0.9rem",
                  border: "1.5px solid var(--cream-deep)", borderRadius: "var(--radius-sm)",
                  fontFamily: "inherit", fontSize: "0.88rem", outline: "none"
                }}
                placeholder="e.g. Sheryl Sandberg, Peter Thiel…"
                value={genName}
                onChange={e => setGenName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleGenerate()}
                disabled={genLoading}
              />
              <button
                onClick={handleGenerate}
                disabled={genLoading || !genName.trim()}
                style={{
                  padding: "0.6rem 1rem", borderRadius: "var(--radius-sm)",
                  background: "var(--lavender)", color: "#fff", border: "none",
                  cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem",
                  opacity: genLoading || !genName.trim() ? 0.6 : 1,
                  minWidth: "90px"
                }}
              >
                {genLoading ? "…" : "Generate"}
              </button>
            </div>
            {genError && (
              <div style={{ fontSize: "0.78rem", color: "#dc2626", marginTop: "0.3rem" }}>
                ⚠ {genError}
              </div>
            )}
          </div>

          {/* Persona grid */}
          <div>
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginBottom: "0.6rem" }}>
              SELECT UP TO {selectedCount} PERSONAS (or use default 4-type audience)
            </div>
            {loading ? (
              <div style={{ textAlign: "center", padding: "1rem" }}>
                <div className="spinner" style={{ margin: "0 auto" }} />
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "0.5rem" }}>
                {personas.map(p => {
                  const isSelected = selected.has(p.id);
                  const isDisabled = !isSelected && selected.size >= selectedCount;
                  return (
                    <button
                      key={p.id}
                      onClick={() => !isDisabled && toggleSelect(p.id)}
                      style={{
                        padding: "0.7rem 0.9rem",
                        background: isSelected ? "var(--lavender-soft)" : "var(--cream)",
                        border: `1.5px solid ${isSelected ? "var(--lavender)" : "transparent"}`,
                        borderRadius: "var(--radius-sm)",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        opacity: isDisabled ? 0.4 : 1,
                        display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "0.2rem",
                        textAlign: "left", fontFamily: "inherit", transition: "all 150ms ease"
                      }}
                    >
                      <div style={{ fontSize: "0.88rem", fontWeight: 500, color: isSelected ? "var(--lavender)" : "var(--text-dark)" }}>
                        {p.displayName}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                        {p.topicsOfInterest.slice(0, 60)}{p.topicsOfInterest.length > 60 ? "…" : ""}
                      </div>
                      {!p.isPreset && (
                        <div style={{ fontSize: "0.62rem", color: "var(--lavender)", marginTop: "0.2rem" }}>✨ Custom</div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Actions */}
          <div style={{ display: "flex", gap: "0.6rem", justifyContent: "flex-end" }}>
            <button
              onClick={handleReset}
              style={{
                padding: "0.55rem 1rem", borderRadius: "100px",
                border: "1.5px solid var(--cream-deep)", background: "transparent",
                color: "var(--text-muted)", cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem"
              }}
            >
              Use Default
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: "0.55rem 1.2rem", borderRadius: "100px",
                background: "var(--lavender)", color: "#fff", border: "none",
                cursor: "pointer", fontFamily: "inherit", fontSize: "0.85rem"
              }}
            >
              Apply {selected.size > 0 ? `(${selected.size})` : "Default"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
