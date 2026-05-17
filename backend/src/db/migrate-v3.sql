-- V3 migration: Plutchik emotion system + appraisal pipeline + relationship depth

-- Add character-level modifiers to characters table
ALTER TABLE characters 
  ADD COLUMN IF NOT EXISTS volatility FLOAT,
  ADD COLUMN IF NOT EXISTS recovery_rate FLOAT;

-- Character baselines table
-- Stores what this character feels like at rest
-- PAD is NOT stored here — it is always computed from Plutchik
CREATE TABLE IF NOT EXISTS character_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE UNIQUE,
  
  -- Plutchik baseline values (resting state)
  joy FLOAT NOT NULL DEFAULT 0.3,
  trust FLOAT NOT NULL DEFAULT 0.3,
  fear FLOAT NOT NULL DEFAULT 0.1,
  surprise FLOAT NOT NULL DEFAULT 0.1,
  sadness FLOAT NOT NULL DEFAULT 0.1,
  disgust FLOAT NOT NULL DEFAULT 0.1,
  anger FLOAT NOT NULL DEFAULT 0.1,
  anticipation FLOAT NOT NULL DEFAULT 0.2,
  desire_intensity FLOAT NOT NULL DEFAULT 0.1,
  desire_nature TEXT NOT NULL DEFAULT 'none',
  
  -- Character-level modifiers
  volatility FLOAT NOT NULL DEFAULT 0.5,
  recovery_rate FLOAT NOT NULL DEFAULT 0.5,
  
  -- Per-emotion decay rate overrides
  -- NULL means use platform default from EMOTION_DECAY_RATES
  joy_decay_override FLOAT,
  trust_decay_override FLOAT,
  fear_decay_override FLOAT,
  surprise_decay_override FLOAT,
  sadness_decay_override FLOAT,
  disgust_decay_override FLOAT,
  anger_decay_override FLOAT,
  anticipation_decay_override FLOAT,
  desire_decay_override FLOAT,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- Emotional state table
-- Live per-character-per-user emotional state
-- PAD is NOT stored — computed on the fly
-- Only Plutchik + desire stored
CREATE TABLE IF NOT EXISTS emotional_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id UUID REFERENCES characters(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  
  -- Current Plutchik values
  joy FLOAT NOT NULL DEFAULT 0.3,
  trust FLOAT NOT NULL DEFAULT 0.3,
  fear FLOAT NOT NULL DEFAULT 0.1,
  surprise FLOAT NOT NULL DEFAULT 0.1,
  sadness FLOAT NOT NULL DEFAULT 0.1,
  disgust FLOAT NOT NULL DEFAULT 0.1,
  anger FLOAT NOT NULL DEFAULT 0.1,
  anticipation FLOAT NOT NULL DEFAULT 0.2,
  
  -- Desire state
  desire_intensity FLOAT NOT NULL DEFAULT 0.1,
  desire_target TEXT NOT NULL DEFAULT 'none',
  desire_nature TEXT NOT NULL DEFAULT 'none',
  
  -- Derived fields (computed and cached, not source of truth)
  derived_state TEXT,
  dominant_primary TEXT,
  momentum TEXT DEFAULT 'stable',
  computed_pad JSONB,  -- cached { pleasure, arousal, dominance }
  
  -- Dynamic goal state
  -- These carry forward as priors between turns
  current_desire TEXT,
  current_objective TEXT,
  last_significant_change TIMESTAMP,
  
  last_updated TIMESTAMP DEFAULT NOW(),
  UNIQUE(character_id, user_id)
);

-- Add columns to relationship_state
ALTER TABLE relationship_state
  ADD COLUMN IF NOT EXISTS resentment FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS intimacy FLOAT DEFAULT 0.0,
  ADD COLUMN IF NOT EXISTS trust_source TEXT DEFAULT 'casual',
  ADD COLUMN IF NOT EXISTS session_count INTEGER DEFAULT 0;

-- Add columns to episodes
ALTER TABLE episodes
  ADD COLUMN IF NOT EXISTS emotion_snapshot JSONB,
  ADD COLUMN IF NOT EXISTS accessed_at TIMESTAMP,
  ADD COLUMN IF NOT EXISTS memory_type TEXT DEFAULT 'episodic';

-- Update narrative_threads type enum to include foreshadowing
-- Note: We can't ALTER TYPE in a transaction block safely, 
-- so we check if the value exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    WHERE t.typname = 'thread_type' AND e.enumlabel = 'foreshadowing'
  ) THEN
    -- If enum doesn't exist yet, the table creation in v2 used TEXT with CHECK
    -- so no action needed
    NULL;
  END IF;
EXCEPTION WHEN undefined_object THEN
  -- enum doesn't exist, which is fine (v2 used TEXT with CHECK)
  NULL;
END $$;

-- Create index for emotional_state lookups
CREATE INDEX IF NOT EXISTS idx_emotional_state_lookup 
  ON emotional_state(character_id, user_id);
