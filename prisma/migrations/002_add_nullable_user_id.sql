-- Migration 002: Add Nullable userId Columns
-- This adds user_id as nullable to all user-scoped tables
-- Run this BEFORE the backfill script

-- Add user_id to jobs (nullable initially)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to resumes (nullable initially)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to linkedin_profiles (nullable initially)
ALTER TABLE linkedin_profiles ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to cover_letters (nullable initially)
ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to applications (nullable initially)
ALTER TABLE applications ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Add user_id to app_settings (nullable initially, will become unique after backfill)
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS user_id TEXT;

-- Create indexes for the new columns (performance during queries)
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_id ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_linkedin_user_id ON linkedin_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_cover_letters_user_id ON cover_letters(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_app_settings_user_id ON app_settings(user_id);
