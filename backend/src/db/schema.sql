CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS characters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_by TEXT NOT NULL,
  description TEXT NOT NULL,
  spec JSONB NOT NULL,
  persona_fidelity_score FLOAT,
  assistant_mold_score FLOAT,
  discord_token TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$ BEGIN
  CREATE TYPE episode_role AS ENUM ('user', 'character');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS episodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id),
  user_id TEXT NOT NULL,
  role episode_role NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  importance FLOAT DEFAULT 0.5,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS relationship_state (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  character_id UUID NOT NULL REFERENCES characters(id),
  user_id TEXT NOT NULL,
  trust FLOAT DEFAULT 0.5,
  familiarity FLOAT DEFAULT 0.0,
  last_interaction TIMESTAMPTZ,
  UNIQUE(character_id, user_id)
);
