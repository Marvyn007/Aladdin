-- Migration: Enhanced Search Indexes for Guaranteed Results
-- This migration adds optimized indexes for the multi-layer search system
-- Ensures fast queries even with millions of rows

-- Enable required extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- HNSW Index for Vector Similarity Search (pgvector)
-- HNSW is faster than IVFFlat for high-dimensional vectors
-- ============================================================================

-- Drop existing index if exists (to recreate with better params)
DROP INDEX IF EXISTS idx_job_embeddings_embedding;

-- Create HNSW index for approximate nearest neighbor search
-- ef_construction: higher = better recall, slower build
-- m: higher = better recall, more memory
CREATE INDEX IF NOT EXISTS idx_job_embeddings_embedding_hnsw 
ON job_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- ============================================================================
-- Composite Indexes for Common Filter Combinations
-- ============================================================================

-- Index for remote-only searches
CREATE INDEX IF NOT EXISTS idx_jobs_remote_location 
ON jobs(location_normalized) 
WHERE location_normalized ILIKE '%remote%' OR location_normalized ILIKE '%work from home%';

-- Index for recent jobs (used in default fallback)
CREATE INDEX IF NOT EXISTS idx_jobs_posted_at_recent 
ON jobs(posted_at DESC NULLS LAST) 
WHERE posted_at > NOW() - INTERVAL '30 days';

-- Composite index for title + posted date (common search pattern)
CREATE INDEX IF NOT EXISTS idx_jobs_title_posted 
ON jobs(title_normalized, posted_at DESC NULLS LAST);

-- ============================================================================
-- Partial Indexes for High-Priority Searches
-- ============================================================================

-- Index for jobs with embeddings (semantic search)
CREATE INDEX IF NOT EXISTS idx_jobs_with_embeddings 
ON jobs(id) 
WHERE id IN (SELECT job_id FROM job_embeddings);

-- Index for fresh jobs only
CREATE INDEX IF NOT EXISTS idx_jobs_fresh 
ON jobs(posted_at DESC) 
WHERE status = 'fresh' OR status IS NULL;

-- ============================================================================
-- GIN Indexes with Better Performance
-- ============================================================================

-- Replace existing GIN indexes with more optimized versions
DROP INDEX IF EXISTS idx_jobs_search_content;

-- Create a more comprehensive full-text search index
CREATE INDEX IF NOT EXISTS idx_jobs_fts_comprehensive 
ON jobs USING GIN (
    to_tsvector('simple', 
        COALESCE(title, '') || ' ' ||
        COALESCE(company, '') || ' ' ||
        COALESCE(location, '') || ' ' ||
        COALESCE(job_description_plain, '')
    )
);

-- ============================================================================
-- Function: Enhanced Search with Multiple Fallbacks
-- ============================================================================

-- Function to get search suggestions with fallback
CREATE OR REPLACE FUNCTION get_search_suggestions(
    p_query TEXT,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    suggestion TEXT,
    suggestion_type TEXT,
    relevance_score FLOAT
) AS $$
DECLARE
    v_normalized TEXT := LOWER(TRIM(p_query));
BEGIN
    -- Return exact matches first
    RETURN QUERY
    SELECT 
        j.title AS suggestion,
        'title'::TEXT AS suggestion_type,
        1.0::FLOAT AS relevance_score
    FROM jobs j
    WHERE j.title_normalized = v_normalized
    LIMIT p_limit;
    
    -- Return prefix matches
    RETURN QUERY
    SELECT 
        j.title AS suggestion,
        'title'::TEXT AS suggestion_type,
        0.9::FLOAT AS relevance_score
    FROM jobs j
    WHERE j.title_normalized LIKE v_normalized || '%'
      AND j.title_normalized != v_normalized
    LIMIT p_limit;
    
    -- Return fuzzy matches using trigram similarity
    RETURN QUERY
    SELECT 
        j.title AS suggestion,
        'title'::TEXT AS suggestion_type,
        similarity(j.title, p_query)::FLOAT AS relevance_score
    FROM jobs j
    WHERE j.title % p_query
      AND j.title_normalized NOT LIKE v_normalized || '%'
    ORDER BY similarity(j.title, p_query) DESC
    LIMIT p_limit;
    
    -- Return company suggestions
    RETURN QUERY
    SELECT 
        j.company AS suggestion,
        'company'::TEXT AS suggestion_type,
        GREATEST(
            similarity(j.company, p_query),
            CASE WHEN j.company_normalized = v_normalized THEN 1.0 ELSE 0.0 END
        )::FLOAT AS relevance_score
    FROM jobs j
    WHERE j.company % p_query OR j.company_normalized = v_normalized
      AND j.company IS NOT NULL
    ORDER BY relevance_score DESC
    LIMIT p_limit / 2;
    
    -- Return location suggestions
    RETURN QUERY
    SELECT 
        j.location AS suggestion,
        'location'::TEXT AS suggestion_type,
        similarity(j.location, p_query)::FLOAT AS relevance_score
    FROM jobs j
    WHERE j.location % p_query
      AND j.location IS NOT NULL
    ORDER BY similarity(j.location, p_query) DESC
    LIMIT p_limit / 2;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Function: Hybrid Search Score
-- Combines text relevance with semantic similarity
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_hybrid_score(
    p_fts_score FLOAT,
    p_semantic_similarity FLOAT,
    p_text_weight FLOAT DEFAULT 0.6,
    p_semantic_weight FLOAT DEFAULT 0.4
)
RETURNS FLOAT AS $$
BEGIN
    RETURN (p_fts_score * p_text_weight) + (p_semantic_similarity * p_semantic_weight);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Function: Tokenize Query for Broad Matching
-- ============================================================================

CREATE OR REPLACE FUNCTION tokenize_query(p_query TEXT)
RETURNS TEXT[] AS $$
DECLARE
    v_normalized TEXT := LOWER(REGEXP_REPLACE(TRIM(p_query), '[^a-zA-Z0-9\s]', ' ', 'g'));
BEGIN
    RETURN STRING_TO_ARRAY(v_normalized, ' ');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- Materialized View: Common Search Terms
-- For fast autocomplete without hitting the main jobs table
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_common_search_terms;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_common_search_terms AS
WITH title_terms AS (
    SELECT 
        title_normalized AS term,
        'title' AS term_type,
        COUNT(*) AS frequency,
        MAX(posted_at) AS last_seen
    FROM jobs
    WHERE title_normalized IS NOT NULL
      AND LENGTH(title_normalized) > 2
    GROUP BY title_normalized
    HAVING COUNT(*) >= 2
),
company_terms AS (
    SELECT 
        company_normalized AS term,
        'company' AS term_type,
        COUNT(*) AS frequency,
        MAX(posted_at) AS last_seen
    FROM jobs
    WHERE company_normalized IS NOT NULL
      AND LENGTH(company_normalized) > 2
    GROUP BY company_normalized
    HAVING COUNT(*) >= 2
),
location_terms AS (
    SELECT 
        location_normalized AS term,
        'location' AS term_type,
        COUNT(*) AS frequency,
        MAX(posted_at) AS last_seen
    FROM jobs
    WHERE location_normalized IS NOT NULL
      AND LENGTH(location_normalized) > 2
    GROUP BY location_normalized
    HAVING COUNT(*) >= 2
)
SELECT * FROM title_terms
UNION ALL
SELECT * FROM company_terms
UNION ALL
SELECT * FROM location_terms;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_mv_common_terms_term ON mv_common_search_terms(term);
CREATE INDEX IF NOT EXISTS idx_mv_common_terms_type ON mv_common_search_terms(term_type);
CREATE INDEX IF NOT EXISTS idx_mv_common_terms_freq ON mv_common_search_terms(frequency DESC);

-- Function to refresh materialized view (call periodically)
CREATE OR REPLACE FUNCTION refresh_common_search_terms()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_common_search_terms;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON INDEX idx_job_embeddings_embedding_hnsw IS 'HNSW index for fast approximate nearest neighbor vector search';
COMMENT ON INDEX idx_jobs_fts_comprehensive IS 'Comprehensive full-text search index on all job fields';
COMMENT ON INDEX idx_jobs_posted_at_recent IS 'Index for recent jobs (30 days), used in default fallback';
COMMENT ON MATERIALIZED VIEW mv_common_search_terms IS 'Cached common search terms for fast autocomplete';
