-- Migration: 009_snapshot_poster_identity
-- Goal: Add poster identity columns to user_jobs for snapshotting and backfill from users table.

-- 1. Add columns to user_jobs
ALTER TABLE user_jobs 
ADD COLUMN IF NOT EXISTS poster_first_name TEXT,
ADD COLUMN IF NOT EXISTS poster_last_name TEXT,
ADD COLUMN IF NOT EXISTS poster_image_url TEXT;

-- 2. Backfill existing data
-- We join user_jobs with jobs to find the original poster (jobs.posted_by_user_id)
-- Then join with users to get their details.
-- Note: We only update rows where the job has a poster.

UPDATE user_jobs uj
SET 
  poster_first_name = u.first_name,
  poster_last_name = u.last_name,
  poster_image_url = u.image_url
FROM jobs j
JOIN users u ON j.posted_by_user_id = u.id
WHERE uj.job_id = j.id
  AND j.posted_by_user_id IS NOT NULL;

-- 3. Validation (Optional but good for check)
-- SELECT count(*) FROM user_jobs WHERE poster_first_name IS NOT NULL;
