-- V2 migration: emotion state, narrative threads, importance retrieval

-- Per-user emotional state for each character
-- valence: -1 (very negative) to 1 (very positive)
-- arousal: 0 (calm/flat) to 1 (intense/activated)
-- desire_intensity: 0 to 1, how much the character wants something from this person
CREATE TABLE IF NOT EXISTS emotion_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  valence FLOAT NOT NULL DEFAULT 0.0,
  arousal FLOAT NOT NULL DEFAULT 0.3,
  desire_intensity FLOAT NOT NULL DEFAULT 0.1,
  derived_label TEXT NOT NULL DEFAULT 'neutral',
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(character_id, user_id)
);

-- Narrative threads: promises, conflicts, secrets, open questions
CREATE TABLE IF NOT EXISTS narrative_threads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('promise', 'conflict', 'secret', 'question')),
  content TEXT NOT NULL,
  emotional_weight FLOAT NOT NULL DEFAULT 0.5,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_narrative_threads_lookup
  ON narrative_threads(character_id, user_id, status);

-- episodes already has importance FLOAT DEFAULT 0.5
-- no change needed there
