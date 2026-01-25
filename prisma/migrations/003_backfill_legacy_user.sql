-- Migration 003: Backfill Existing Records with Legacy User
-- Run this AFTER migration 002 to assign all existing records to the legacy user

-- Backfill jobs
UPDATE jobs SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- Backfill resumes
UPDATE resumes SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- Backfill linkedin_profiles
UPDATE linkedin_profiles SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- Backfill cover_letters
UPDATE cover_letters SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- Backfill applications
UPDATE applications SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- Backfill app_settings (or create default if empty)
UPDATE app_settings SET user_id = 'legacy_user_001' WHERE user_id IS NULL;

-- If no app_settings exist, create one for legacy user
INSERT INTO app_settings (user_id, fresh_limit, excluded_keywords, created_at)
SELECT 'legacy_user_001', 300, '[]'::jsonb, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM app_settings WHERE user_id = 'legacy_user_001');

-- Verify backfill completed (these should all return 0)
-- SELECT COUNT(*) FROM jobs WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM resumes WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM linkedin_profiles WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM cover_letters WHERE user_id IS NULL;
-- SELECT COUNT(*) FROM applications WHERE user_id IS NULL;
