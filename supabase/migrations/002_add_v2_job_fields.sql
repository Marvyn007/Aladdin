-- Migration to add V2 job scraper fields to the jobs table
-- These fields support enhanced job data extraction and imported jobs

-- Add is_imported flag
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_imported INTEGER DEFAULT 0;

-- Add original posted date fields (for preserving posted date from source)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_posted_date TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_posted_raw TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS original_posted_source TEXT;

-- Add location display field
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_display TEXT;

-- Add import tag for filtering imported jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS import_tag TEXT;

-- V2 Scraper fields for enhanced job data extraction
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS raw_description_html TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_description_plain TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS date_posted_iso TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS date_posted_display TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS date_posted_relative INTEGER DEFAULT 0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS source_host TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS extraction_confidence JSONB;

-- Create index for filtering by import_tag
CREATE INDEX IF NOT EXISTS idx_jobs_import_tag ON jobs(import_tag) WHERE import_tag IS NOT NULL;

-- Create index for is_imported
CREATE INDEX IF NOT EXISTS idx_jobs_is_imported ON jobs(is_imported) WHERE is_imported = 1;

-- ============================================================================
-- COVER LETTERS TABLE UPDATES
-- ============================================================================

-- Add status column for cover letter generation tracking
ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'generated';

-- Add s3_key column for cloud storage
ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- ============================================================================
-- RESUMES TABLE UPDATES
-- ============================================================================

-- Add s3_key column for cloud storage (if not exists)
ALTER TABLE resumes ADD COLUMN IF NOT EXISTS s3_key TEXT;

-- ============================================================================
-- LINKEDIN PROFILES TABLE UPDATES  
-- ============================================================================

-- Add s3_key column for cloud storage (if not exists)
ALTER TABLE linkedin_profiles ADD COLUMN IF NOT EXISTS s3_key TEXT;
