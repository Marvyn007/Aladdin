-- Supabase migration for job-hunt-vibe
-- Run this in your Supabase SQL editor or via migrations

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  company TEXT,
  location TEXT,
  source_url TEXT NOT NULL,
  posted_at TIMESTAMPTZ,
  fetched_at TIMESTAMPTZ DEFAULT NOW(),
  status TEXT CHECK (status IN ('fresh', 'archived')) DEFAULT 'fresh',
  archived_at TIMESTAMPTZ,
  match_score INTEGER DEFAULT 0,
  matched_skills JSONB,
  missing_skills JSONB,
  why TEXT,
  normalized_text TEXT,
  raw_text_summary TEXT,
  content_hash TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Resumes table
CREATE TABLE IF NOT EXISTS resumes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  upload_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_json JSONB,
  is_default BOOLEAN DEFAULT FALSE,
  file_data BYTEA, -- Store PDF binary for re-processing if needed
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LinkedIn profiles table
CREATE TABLE IF NOT EXISTS linkedin_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  upload_at TIMESTAMPTZ DEFAULT NOW(),
  parsed_json JSONB,
  file_data BYTEA,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cover letters table (create before applications due to FK)
CREATE TABLE IF NOT EXISTS cover_letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  content_html TEXT,
  content_text TEXT,
  pdf_blob_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Applications table (Kanban tracker)
CREATE TABLE IF NOT EXISTS applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
  column_name TEXT CHECK (column_name IN ('Applied', 'Got OA', 'Interview R1', 'Interview R2', 'Interview R3', 'Interview R4', 'Got Offer')) DEFAULT 'Applied',
  applied_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT,
  resume_id UUID REFERENCES resumes(id) ON DELETE SET NULL,
  cover_letter_id UUID REFERENCES cover_letters(id) ON DELETE SET NULL,
  external_link TEXT,
  deleted BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- App settings table (single row for app configuration)
CREATE TABLE IF NOT EXISTS app_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1), -- Ensure only one row
  fresh_limit INTEGER DEFAULT 300,
  last_updated TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default settings
INSERT INTO app_settings (id, fresh_limit) VALUES (1, 300) ON CONFLICT (id) DO NOTHING;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs(fetched_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status_score ON jobs(status, match_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_content_hash ON jobs(content_hash);

-- Full-text search index on normalized_text
CREATE INDEX IF NOT EXISTS idx_jobs_normalized_text_gin ON jobs USING GIN (to_tsvector('english', COALESCE(normalized_text, '')));

-- Index for applications
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_column ON applications(column_name);
CREATE INDEX IF NOT EXISTS idx_applications_not_deleted ON applications(deleted) WHERE deleted = FALSE;

-- Index for resumes default lookup
CREATE INDEX IF NOT EXISTS idx_resumes_default ON resumes(is_default) WHERE is_default = TRUE;

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to jobs table
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply trigger to applications table
DROP TRIGGER IF EXISTS update_applications_updated_at ON applications;
CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to archive old jobs (called by Archiver Agent)
CREATE OR REPLACE FUNCTION archive_old_jobs()
RETURNS INTEGER AS $$
DECLARE
    archived_count INTEGER;
BEGIN
    UPDATE jobs
    SET status = 'archived'
    WHERE status = 'fresh'
    AND fetched_at < NOW() - INTERVAL '24 hours';
    
    GET DIAGNOSTICS archived_count = ROW_COUNT;
    RETURN archived_count;
END;
$$ LANGUAGE plpgsql;

-- Function to purge old archived jobs (older than 7 days)
CREATE OR REPLACE FUNCTION purge_old_archives()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- First delete related records
    DELETE FROM applications
    WHERE job_id IN (
        SELECT id FROM jobs
        WHERE status = 'archived'
        AND fetched_at < NOW() - INTERVAL '7 days'
    );
    
    DELETE FROM cover_letters
    WHERE job_id IN (
        SELECT id FROM jobs
        WHERE status = 'archived'
        AND fetched_at < NOW() - INTERVAL '7 days'
    );
    
    -- Then delete jobs
    DELETE FROM jobs
    WHERE status = 'archived'
    AND fetched_at < NOW() - INTERVAL '7 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Row Level Security (RLS) - Disabled for single-user app
-- If you want to enable RLS later, uncomment these:
-- ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE resumes ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE cover_letters ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE linkedin_profiles ENABLE ROW LEVEL SECURITY;
