import { useState, useEffect, useCallback } from "react";
import { getNotes, deleteNote, type NoteRecord } from "../lib/db";

export function NotesList() {
  const [notes, setNotes]       = useState<NoteRecord[]>([]);
  const [loading, setLoading]   = useState(true);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    getNotes()
      .then(setNotes)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleExport = useCallback((note: NoteRecord) => {
    const header = note.topic ? `Session: ${note.topic}\nDate: ${new Date(note.savedAt).toLocaleString()}\n\n` : "";
    const blob = new Blob([header + note.content], { type: "text/plain;charset=utf-8" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `rehearse-notes-${note.sessionId.slice(0, 8)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleDelete = useCallback(async (sessionId: string) => {
    if (!confirm("Delete this note? This cannot be undone.")) return;
    setDeleting(sessionId);
    try {
      await deleteNote(sessionId);
      setNotes(prev => prev.filter(n => n.sessionId !== sessionId));
    } catch (e) {
      console.error("[NotesList] delete failed:", e);
    } finally {
      setDeleting(null);
    }
  }, []);

  return (
    <div className="screen notes-list fade-in" style={{ padding: "2.5rem 2rem", alignItems: "flex-start", justifyContent: "flex-start", minHeight: "100vh" }}>
      <div style={{ width: "100%", marginBottom: "2rem" }}>
        <h1 className="screen-title" style={{ fontSize: "2rem" }}>Saved Notes</h1>
        <p className="screen-subtitle">Thoughts and adjustments you wrote during sessions</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem", color: "var(--text-muted)", padding: "2rem 0" }}>
          <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
          Loading notes…
        </div>
      ) : (
        <div style={{ width: "100%", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "1.5rem" }}>
          {notes.length === 0 ? (
            <div style={{ gridColumn: "1 / -1", padding: "3rem", background: "#fff", borderRadius: "var(--radius-lg)", textAlign: "center", color: "var(--text-muted)", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: "2rem", marginBottom: "0.8rem" }}>📝</div>
              No saved notes yet. Use the <strong>Notepad</strong> icon during a session to jot down thoughts.
            </div>
          ) : (
            notes.map(note => (
              <div key={note.sessionId} className="moment-card" style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div>
                    {note.topic && (
                      <div style={{ fontSize: "0.9rem", fontWeight: 500, color: "var(--text-dark)", marginBottom: "0.15rem" }}>
                        {note.topic}
                      </div>
                    )}
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                      {note.savedAt ? new Date(note.savedAt).toLocaleString() : `ID: ${note.sessionId.slice(0, 8)}…`}
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div style={{ flex: 1, whiteSpace: "pre-wrap", fontSize: "0.92rem", color: "var(--text-mid)", lineHeight: 1.6, background: "var(--cream)", borderRadius: "var(--radius-sm)", padding: "0.8rem", minHeight: "80px" }}>
                  {note.content}
                </div>

                {/* Actions */}
                <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.2rem" }}>
                  <button
                    className="btn btn--outline"
                    onClick={() => handleExport(note)}
                    style={{ fontSize: "0.78rem", padding: "0.45rem 0.8rem", flex: 1 }}
                  >
                    ↓ Export
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => handleDelete(note.sessionId)}
                    disabled={deleting === note.sessionId}
                    style={{ fontSize: "0.78rem", padding: "0.45rem 0.8rem", color: "#dc2626", flex: 1 }}
                  >
                    {deleting === note.sessionId ? "Deleting…" : "🗑 Delete"}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
