-- Migration 004: Make userId Non-Nullable with Foreign Keys
-- Run this AFTER backfill is complete and verified

-- Make user_id NOT NULL on all tables
ALTER TABLE jobs ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE resumes ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE linkedin_profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE cover_letters ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE applications ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE app_settings ALTER COLUMN user_id SET NOT NULL;

-- Add foreign key constraints to users table
ALTER TABLE jobs 
    ADD CONSTRAINT fk_jobs_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE resumes 
    ADD CONSTRAINT fk_resumes_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE linkedin_profiles 
    ADD CONSTRAINT fk_linkedin_profiles_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE cover_letters 
    ADD CONSTRAINT fk_cover_letters_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE applications 
    ADD CONSTRAINT fk_applications_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE app_settings 
    ADD CONSTRAINT fk_app_settings_user 
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Add unique constraint on app_settings.user_id (one settings per user)
ALTER TABLE app_settings ADD CONSTRAINT app_settings_user_id_unique UNIQUE (user_id);

-- Create composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_jobs_user_status_score ON jobs(user_id, status, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_resumes_user_default ON resumes(user_id, is_default);
CREATE INDEX IF NOT EXISTS idx_applications_user_job ON applications(user_id, job_id);
