-- Migration: Add location enrichment fields for improved geocoding
-- This supports the "View Jobs on Map" feature with confidence scoring and provenance

-- ============================================================================
-- JOBS TABLE UPDATES
-- ============================================================================

-- Add raw location text (original textual location from posting)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_raw TEXT;

-- Add geocoded timestamp
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geocoded_at TIMESTAMPTZ;

-- Add location dedup key for caching enrichment results
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_dedup_key TEXT;

-- Create index on location_dedup_key for caching lookups
CREATE INDEX IF NOT EXISTS idx_jobs_location_dedup_key ON jobs(location_dedup_key) WHERE location_dedup_key IS NOT NULL;

-- ============================================================================
-- JOB_GEO_POINTS TABLE UPDATES
-- ============================================================================

-- Add source field (e.g., "poster-provided", "geocoded-address", "company-hq", "city-centroid")
ALTER TABLE job_geo_points ADD COLUMN IF NOT EXISTS source TEXT;

-- Add raw location text from the job for provenance
ALTER TABLE job_geo_points ADD COLUMN IF NOT EXISTS raw_location_text TEXT;

-- Add flag for user-corrected locations
ALTER TABLE job_geo_points ADD COLUMN IF NOT EXISTS is_user_corrected BOOLEAN DEFAULT false;

-- Create index on source for filtering by geocoding method
CREATE INDEX IF NOT EXISTS idx_job_geo_points_source ON job_geo_points(source) WHERE source IS NOT NULL;

-- Create index on is_user_corrected for filtering user corrections
CREATE INDEX IF NOT EXISTS idx_job_geo_points_user_corrected ON job_geo_points(is_user_corrected) WHERE is_user_corrected = true;