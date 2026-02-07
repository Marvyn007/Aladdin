-- Migration: Add search functionality columns and indexes
-- This migration adds tokenized search fields and indexes for the two-stage search pipeline

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;      -- For fuzzy matching
CREATE EXTENSION IF NOT EXISTS vector;       -- Already exists, but ensure it's enabled

-- Add normalized text columns for partial matching
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS title_normalized TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS company_normalized TEXT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_normalized TEXT;

-- Add full-text search token columns
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_title_tokens TSVECTOR;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_company_tokens TSVECTOR;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_location_tokens TSVECTOR;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_content TSVECTOR;

-- Add match quality columns (updated by triggers)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_boost_score FLOAT DEFAULT 1.0;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS common_title_category TEXT;

-- Create indexes for normalized text columns
CREATE INDEX IF NOT EXISTS idx_jobs_title_normalized ON jobs(title_normalized);
CREATE INDEX IF NOT EXISTS idx_jobs_company_normalized ON jobs(company_normalized);
CREATE INDEX IF NOT EXISTS idx_jobs_location_normalized ON jobs(location_normalized);

-- Create GIN indexes for full-text search
CREATE INDEX IF NOT EXISTS idx_jobs_search_title ON jobs USING GIN(search_title_tokens);
CREATE INDEX IF NOT EXISTS idx_jobs_search_company ON jobs USING GIN(search_company_tokens);
CREATE INDEX IF NOT EXISTS idx_jobs_search_location ON jobs USING GIN(search_location_tokens);
CREATE INDEX IF NOT EXISTS idx_jobs_search_content ON jobs USING GIN(search_content);

-- Create trigram indexes for fuzzy matching
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm ON jobs USING GIN(title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_company_trgm ON jobs USING GIN(company gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_jobs_location_trgm ON jobs USING GIN(location gin_trgm_ops);

-- Function to normalize text
CREATE OR REPLACE FUNCTION normalize_search_text(input TEXT)
RETURNS TEXT AS $$
BEGIN
    RETURN LOWER(REGEXP_REPLACE(TRIM(COALESCE(input, '')), '[^a-zA-Z0-9\s]', '', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to update normalized columns
CREATE OR REPLACE FUNCTION update_job_normalized_fields()
RETURNS TRIGGER AS $$
BEGIN
    NEW.title_normalized := normalize_search_text(NEW.title);
    NEW.company_normalized := normalize_search_text(NEW.company);
    NEW.location_normalized := normalize_search_text(NEW.location);
    
    -- Update full-text search vectors
    NEW.search_title_tokens := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A');
    NEW.search_company_tokens := 
        setweight(to_tsvector('simple', COALESCE(NEW.company, '')), 'B');
    NEW.search_location_tokens := 
        setweight(to_tsvector('simple', COALESCE(NEW.location, '')), 'C');
    NEW.search_content := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.company, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(NEW.location, '')), 'C') ||
        setweight(to_tsvector('simple', COALESCE(NEW.job_description_plain, '')), 'D');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_job_search_update ON jobs;

-- Create trigger to auto-update search fields
CREATE TRIGGER trg_job_search_update
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION update_job_normalized_fields();

-- Backfill existing jobs (run in batches for large datasets)
-- UPDATE jobs SET title = title WHERE search_content IS NULL;

-- Create table for tracking search queries (for analytics & improvement)
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_text TEXT NOT NULL,
    query_normalized TEXT,
    results_count INTEGER,
    clicked_job_id UUID REFERENCES jobs(id),
    user_id TEXT REFERENCES users(id),
    session_id TEXT,
    search_duration_ms INTEGER,
    filters_used JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_analytics_query ON search_analytics(query_normalized);
CREATE INDEX IF NOT EXISTS idx_search_analytics_created ON search_analytics(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_analytics_user ON search_analytics(user_id);

-- Create table for common search terms (for autocomplete)
CREATE TABLE IF NOT EXISTS search_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    term TEXT NOT NULL UNIQUE,
    term_type TEXT NOT NULL CHECK (term_type IN ('title', 'company', 'location', 'skill')),
    frequency INTEGER DEFAULT 1,
    last_seen_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_search_suggestions_term ON search_suggestions(term);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_type ON search_suggestions(term_type);
CREATE INDEX IF NOT EXISTS idx_search_suggestions_freq ON search_suggestions(frequency DESC);

-- Function to increment suggestion frequency
CREATE OR REPLACE FUNCTION increment_suggestion_frequency(p_term TEXT, p_type TEXT)
RETURNS VOID AS $$
BEGIN
    INSERT INTO search_suggestions (term, term_type, frequency)
    VALUES (LOWER(TRIM(p_term)), p_type, 1)
    ON CONFLICT (term) 
    DO UPDATE SET 
        frequency = search_suggestions.frequency + 1,
        last_seen_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON COLUMN jobs.search_title_tokens IS 'Full-text search vector for job title (weight A)';
COMMENT ON COLUMN jobs.search_company_tokens IS 'Full-text search vector for company name (weight B)';
COMMENT ON COLUMN jobs.search_location_tokens IS 'Full-text search vector for location (weight C)';
COMMENT ON COLUMN jobs.search_content IS 'Combined full-text search vector for all job fields';
COMMENT ON COLUMN jobs.title_normalized IS 'Lowercase, cleaned title for partial matching';
COMMENT ON COLUMN jobs.company_normalized IS 'Lowercase, cleaned company for partial matching';
COMMENT ON COLUMN jobs.location_normalized IS 'Lowercase, cleaned location for partial matching';
