-- Phase 6: Make source and externalId non-nullable, add unique constraint
-- Prerequisites: Run backfill script first (POST /api/admin/backfill)

-- Step 1: Backfill NULLs with safe defaults
UPDATE jobs SET source = 'imported' WHERE source IS NULL;
UPDATE jobs SET external_id = '' WHERE external_id IS NULL;

-- Step 2: Make columns non-nullable with defaults
ALTER TABLE jobs ALTER COLUMN source SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN source SET DEFAULT 'imported';
ALTER TABLE jobs ALTER COLUMN external_id SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN external_id SET DEFAULT '';

-- Step 3: Drop old composite index (replaced by unique constraint)
DROP INDEX IF EXISTS idx_jobs_source_external_id;

-- Step 4: Add unique constraint on (source, external_id)
ALTER TABLE jobs ADD CONSTRAINT uniq_jobs_source_external_id UNIQUE (source, external_id);
