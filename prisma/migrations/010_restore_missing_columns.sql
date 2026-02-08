
-- 1. Restore user_id column if missing
ALTER TABLE user_jobs ADD COLUMN IF NOT EXISTS user_id TEXT REFERENCES users(id) ON DELETE CASCADE;

-- 2. Delete rows where user_id is NULL (orphaned data from previous schema corruption)
DELETE FROM user_jobs WHERE user_id IS NULL;

-- 3. Make user_id NOT NULL
ALTER TABLE user_jobs ALTER COLUMN user_id SET NOT NULL;

-- 4. Ensure Unique Index exists
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_job ON user_jobs(user_id, job_id);

-- 5. Backfill Poster Data (restores Snapshot and ensures jobs have at least one user_job entry)
INSERT INTO user_jobs (user_id, job_id, status, match_score, created_at, updated_at, poster_first_name, poster_last_name, poster_image_url)
SELECT 
    j.posted_by_user_id, 
    j.id, 
    'fresh', 
    0, 
    j.created_at, 
    j.updated_at,
    u.first_name,
    u.last_name,
    u.image_url
FROM jobs j
JOIN users u ON j.posted_by_user_id = u.id
ON CONFLICT (user_id, job_id) DO UPDATE SET
    poster_first_name = EXCLUDED.poster_first_name,
    poster_last_name = EXCLUDED.poster_last_name,
    poster_image_url = EXCLUDED.poster_image_url;
