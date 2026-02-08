-- Migration: Create user_votes table for vote tracking
-- Each user can only vote once per target user (up or down)

CREATE TABLE IF NOT EXISTS user_votes (
    id SERIAL PRIMARY KEY,
    voter_id TEXT NOT NULL,
    target_user_id TEXT NOT NULL,
    vote_type TEXT NOT NULL CHECK (vote_type IN ('up', 'down')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(voter_id, target_user_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_votes_voter ON user_votes(voter_id);
CREATE INDEX IF NOT EXISTS idx_user_votes_target ON user_votes(target_user_id);

-- Add votes column to users table if not exists
ALTER TABLE users ADD COLUMN IF NOT EXISTS votes INTEGER DEFAULT 0;
