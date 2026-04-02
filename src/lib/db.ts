/**
 * db.ts — persistence layer
 *
 * Strategy:
 *   1. Always write to localStorage (fast, offline-first).
 *   2. Also write to Supabase when the client is available.
 *   3. Reads prefer Supabase; fall back to localStorage.
 *
 * This means the app works even without a Supabase connection.
 */

import { supabase } from "./supabase";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SessionRecord {
  sessionId: string;
  date: string;
  topic: string;
  domain: string;
  difficultyLevel: number;
  score: number;
  duration: number;
  bestMoment: string;
  hardestMoment: string;
  improvement: string;
  interventionCount: number;
}

export interface NoteRecord {
  sessionId: string;
  content: string;
  savedAt: string;
  topic?: string;
}

// ─── Session persistence ──────────────────────────────────────────────────────

export async function saveSession(record: SessionRecord): Promise<void> {
  // 1. localStorage (always)
  try {
    const raw = localStorage.getItem("rehearse_reports_history");
    const history: SessionRecord[] = raw ? JSON.parse(raw) : [];
    // replace if exists, else push
    const idx = history.findIndex(r => r.sessionId === record.sessionId);
    if (idx >= 0) history[idx] = record;
    else history.push(record);
    localStorage.setItem("rehearse_reports_history", JSON.stringify(history));
  } catch (e) {
    console.warn("[db] localStorage write failed:", e);
  }

  // 2. Supabase (best-effort)
  if (!supabase) return;
  try {
    await supabase.from("sessions").upsert({
      id: record.sessionId,
      topic: record.topic,
      domain: record.domain,
      difficulty_level: record.difficultyLevel,
      score: record.score,
      duration: record.duration,
      best_moment: record.bestMoment,
      hardest_moment: record.hardestMoment,
      improvement: record.improvement,
      intervention_count: record.interventionCount,
      created_at: record.date,
    });
  } catch (e) {
    console.warn("[db] Supabase session upsert failed:", e);
  }
}

export async function getSessions(): Promise<SessionRecord[]> {
  // Try Supabase first
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map((r: Record<string, unknown>) => ({
          sessionId:         r.id as string,
          date:              r.created_at as string,
          topic:             r.topic as string,
          domain:            r.domain as string,
          difficultyLevel:   r.difficulty_level as number,
          score:             r.score as number,
          duration:          r.duration as number,
          bestMoment:        r.best_moment as string,
          hardestMoment:     r.hard_moment as string,
          improvement:       r.improvement as string,
          interventionCount: r.intervention_count as number,
        }));
      }
    } catch (e) {
      console.warn("[db] Supabase getSessions failed, falling back:", e);
    }
  }

  // Fallback to localStorage
  try {
    const raw = localStorage.getItem("rehearse_reports_history");
    if (raw) return (JSON.parse(raw) as SessionRecord[]).reverse();
  } catch { /* parse error */ }
  return [];
}

// ─── Notes persistence ────────────────────────────────────────────────────────

export async function saveNote(record: NoteRecord): Promise<void> {
  // 1. localStorage
  try {
    localStorage.setItem(`rehearse_notes_${record.sessionId}`, record.content);
    // also keep a notes index for the NotesList view
    const rawIdx = localStorage.getItem("rehearse_notes_index");
    const index: Omit<NoteRecord, "content">[] = rawIdx ? JSON.parse(rawIdx) : [];
    const idx = index.findIndex(n => n.sessionId === record.sessionId);
    const meta = { sessionId: record.sessionId, savedAt: record.savedAt, topic: record.topic };
    if (idx >= 0) index[idx] = meta;
    else index.push(meta);
    localStorage.setItem("rehearse_notes_index", JSON.stringify(index));
  } catch (e) {
    console.warn("[db] localStorage note write failed:", e);
  }

  // 2. Supabase (best-effort)
  if (!supabase) return;
  try {
    await supabase.from("notes").upsert({
      session_id: record.sessionId,
      content: record.content,
      created_at: record.savedAt,
    });
  } catch (e) {
    console.warn("[db] Supabase note upsert failed:", e);
  }
}

export async function getNotes(): Promise<NoteRecord[]> {
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("notes")
        .select("session_id, content, created_at")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map((r: Record<string, unknown>) => ({
          sessionId: r.session_id as string,
          content:   r.content as string,
          savedAt:   r.created_at as string,
        }));
      }
    } catch (e) {
      console.warn("[db] Supabase getNotes failed, falling back:", e);
    }
  }

  // Fallback: read all notes from localStorage via index
  try {
    const rawIdx = localStorage.getItem("rehearse_notes_index");
    const index: Omit<NoteRecord, "content">[] = rawIdx ? JSON.parse(rawIdx) : [];

    const notes: NoteRecord[] = [];
    for (const meta of index.reverse()) {
      const content = localStorage.getItem(`rehearse_notes_${meta.sessionId}`) ?? "";
      if (content.trim()) notes.push({ ...meta, content });
    }
    return notes;
  } catch { /* parse error */ }
  return [];
}

export async function deleteNote(sessionId: string): Promise<void> {
  localStorage.removeItem(`rehearse_notes_${sessionId}`);

  try {
    const rawIdx = localStorage.getItem("rehearse_notes_index");
    if (rawIdx) {
      const index: Omit<NoteRecord, "content">[] = JSON.parse(rawIdx);
      localStorage.setItem(
        "rehearse_notes_index",
        JSON.stringify(index.filter(n => n.sessionId !== sessionId))
      );
    }
  } catch { /* parse error */ }

  if (!supabase) return;
  try {
    await supabase.from("notes").delete().eq("session_id", sessionId);
  } catch (e) {
    console.warn("[db] Supabase deleteNote failed:", e);
  }
}
