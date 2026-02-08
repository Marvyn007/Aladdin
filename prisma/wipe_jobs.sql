-- Wipe all jobs and related data
-- Handles Foreign Key constraints by setting references to NULL first or relying on CASCADE

BEGIN;

-- 1. Detach SearchAnalytics (onDelete: NoAction prevents deletion otherwise)
UPDATE search_analytics 
SET clicked_job_id = NULL 
WHERE clicked_job_id IS NOT NULL;

-- 2. Delete all jobs
-- This will CASCADE delete:
-- - user_jobs
-- - applications (referencing job_id)
-- - cover_letters (referencing job_id)
-- - job_embeddings
-- - job_geo_points
-- - user_interactions
DELETE FROM jobs;

COMMIT;

-- 3. Verify
SELECT COUNT(*) as remaining_jobs FROM jobs;
SELECT COUNT(*) as remaining_user_jobs FROM user_jobs;
