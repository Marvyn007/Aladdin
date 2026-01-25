-- Migration 005: Global Jobs Refactor

-- 1. Create table for user-specific job state (Private)
CREATE TABLE IF NOT EXISTS user_jobs (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('fresh', 'archived')) DEFAULT 'fresh',
    archived_at TIMESTAMPTZ,
    match_score FLOAT DEFAULT 0,
    matched_skills TEXT,         -- JSON
    missing_skills TEXT,         -- JSON
    why TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, job_id)
);

-- 2. Backfill user_jobs from existing jobs table
-- Preserves existing user ownership and state
INSERT INTO user_jobs (user_id, job_id, status, archived_at, match_score, matched_skills, missing_skills, why, created_at, updated_at)
SELECT user_id, id, status, archived_at, match_score, matched_skills, missing_skills, why, created_at, updated_at
FROM jobs
WHERE user_id IS NOT NULL; 

-- 3. Make jobs table Global (Public)
-- Drop user-specific columns. 
-- Note: This syntax works for Postgres. SQLite requires table recreation.
ALTER TABLE jobs DROP COLUMN user_id;
ALTER TABLE jobs DROP COLUMN status;
ALTER TABLE jobs DROP COLUMN archived_at;
ALTER TABLE jobs DROP COLUMN match_score;
ALTER TABLE jobs DROP COLUMN matched_skills;
ALTER TABLE jobs DROP COLUMN missing_skills;
ALTER TABLE jobs DROP COLUMN why;

-- 4. Create Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_jobs_status ON user_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_jobs_score ON user_jobs(user_id, match_score DESC);
