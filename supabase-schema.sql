-- REHEARSE — Supabase Schema Migration
-- Run this in your Supabase SQL Editor: https://supabase.com/dashboard/project/pmhgdoxfxkmoqaecepvp/sql/new

-- ─── Sessions table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id                 UUID        PRIMARY KEY,
  user_id            TEXT        DEFAULT 'guest',
  topic              TEXT        NOT NULL,
  domain             TEXT        DEFAULT 'general',
  difficulty_level   INT         DEFAULT 3 CHECK (difficulty_level BETWEEN 1 AND 5),
  score              NUMERIC(4,1) CHECK (score BETWEEN 1 AND 10),
  duration           INT,           -- seconds
  best_moment        TEXT,
  hard_moment        TEXT,
  improvement        TEXT,
  intervention_count INT         DEFAULT 0,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- Index for fast per-user queries (future auth integration)
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions (user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: anyone can insert/read (guest mode — tighten when auth is added)
CREATE POLICY "allow_all_sessions" ON sessions FOR ALL USING (true) WITH CHECK (true);

-- ─── Notes table ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID        REFERENCES sessions(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notes_session_id_idx ON notes (session_id);

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_notes" ON notes FOR ALL USING (true) WITH CHECK (true);

-- ─── Verify ───────────────────────────────────────────────────────────────────
-- SELECT * FROM sessions LIMIT 5;
-- SELECT * FROM notes LIMIT 5;
