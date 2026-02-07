-- Migration: Smart Search Analytics and Autofill
-- Adds enhanced analytics tracking for smart search suggestions
-- Creates indexes for popular searches and trending queries

-- ============================================================================
-- Enhanced Search Analytics Indexes
-- ============================================================================

-- Index for query-based aggregation (safe replacement for illegal partial indexes)
CREATE INDEX IF NOT EXISTS idx_search_analytics_query_created 
ON search_analytics(query_normalized, created_at DESC);

-- Index for user-specific search history
CREATE INDEX IF NOT EXISTS idx_search_analytics_user_query 
ON search_analytics(user_id, query_normalized, created_at DESC);

-- Composite index for analytics aggregation
CREATE INDEX IF NOT EXISTS idx_search_analytics_aggregated 
ON search_analytics(query_normalized, created_at) 
INCLUDE (results_count, user_id);

-- ============================================================================
-- Materialized View: Popular Search Queries
-- Pre-aggregated popular searches for fast autocomplete
-- ============================================================================

DROP MATERIALIZED VIEW IF EXISTS mv_popular_searches;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_popular_searches AS
SELECT 
    query_normalized as query,
    COUNT(*) as search_count,
    COUNT(DISTINCT user_id) as unique_users,
    COUNT(DISTINCT session_id) as unique_sessions,
    MAX(results_count) as max_results,
    AVG(results_count)::INTEGER as avg_results,
    MAX(created_at) as last_searched,
    MIN(created_at) as first_searched,
    -- Calculate trend (searches in last 7 days vs previous 7 days)
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as recent_count,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '14 days' AND created_at <= NOW() - INTERVAL '7 days') as previous_count
FROM search_analytics
WHERE query_normalized IS NOT NULL
  AND LENGTH(query_normalized) > 2
  AND created_at > NOW() - INTERVAL '90 days'
GROUP BY query_normalized
HAVING COUNT(*) >= 2
ORDER BY COUNT(*) DESC, MAX(created_at) DESC;

-- Indexes on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_popular_searches_query 
ON mv_popular_searches(query);

CREATE INDEX IF NOT EXISTS idx_mv_popular_searches_count 
ON mv_popular_searches(search_count DESC);

CREATE INDEX IF NOT EXISTS idx_mv_popular_searches_recent 
ON mv_popular_searches(recent_count DESC);

-- ============================================================================
-- Function: Refresh Popular Searches Materialized View
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_popular_searches()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_popular_searches;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Function: Get Smart Search Suggestions
-- Combines job database with popular searches for intelligent suggestions
-- ============================================================================

CREATE OR REPLACE FUNCTION get_smart_search_suggestions(
    p_query TEXT,
    p_type TEXT DEFAULT 'all',
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    suggestion TEXT,
    suggestion_type TEXT,
    rank_score FLOAT,
    is_popular BOOLEAN,
    match_count INTEGER,
    highlight_start INTEGER,
    highlight_end INTEGER
) AS $$
DECLARE
    v_normalized TEXT := LOWER(TRIM(p_query));
    v_query_length INTEGER := LENGTH(v_normalized);
BEGIN
    -- Return popular searches that match (highest priority)
    RETURN QUERY
    SELECT 
        ps.query::TEXT as suggestion,
        'trending'::TEXT as suggestion_type,
        (ps.search_count * 5 + ps.unique_users * 2)::FLOAT as rank_score,
        TRUE as is_popular,
        ps.search_count::INTEGER as match_count,
        0::INTEGER as highlight_start,
        v_query_length::INTEGER as highlight_end
    FROM mv_popular_searches ps
    WHERE ps.query ILIKE v_normalized || '%'
      AND (p_type = 'all' OR p_type = 'trending')
    ORDER BY ps.search_count DESC, ps.last_searched DESC
    LIMIT p_limit / 2;

    -- Return job titles with high frequency
    RETURN QUERY
    SELECT 
        j.title::TEXT as suggestion,
        'title'::TEXT as suggestion_type,
        (COUNT(*) * 3)::FLOAT as rank_score,
        CASE WHEN COUNT(*) >= 5 THEN TRUE ELSE FALSE END as is_popular,
        COUNT(*)::INTEGER as match_count,
        0::INTEGER as highlight_start,
        v_query_length::INTEGER as highlight_end
    FROM jobs j
    WHERE j.title_normalized ILIKE v_normalized || '%'
      AND j.title IS NOT NULL
      AND (p_type = 'all' OR p_type = 'title')
    GROUP BY j.title, j.title_normalized
    ORDER BY COUNT(*) DESC, MAX(j.posted_at) DESC NULLS LAST
    LIMIT p_limit / 3;

    -- Return company suggestions
    RETURN QUERY
    SELECT 
        j.company::TEXT as suggestion,
        'company'::TEXT as suggestion_type,
        (COUNT(*) * 4)::FLOAT as rank_score,
        CASE WHEN COUNT(*) >= 3 THEN TRUE ELSE FALSE END as is_popular,
        COUNT(*)::INTEGER as match_count,
        0::INTEGER as highlight_start,
        v_query_length::INTEGER as highlight_end
    FROM jobs j
    WHERE j.company_normalized ILIKE v_normalized || '%'
      AND j.company IS NOT NULL
      AND (p_type = 'all' OR p_type = 'company')
    GROUP BY j.company, j.company_normalized
    ORDER BY COUNT(*) DESC, MAX(j.posted_at) DESC NULLS LAST
    LIMIT p_limit / 4;

    -- Return location suggestions
    RETURN QUERY
    SELECT 
        j.location::TEXT as suggestion,
        'location'::TEXT as suggestion_type,
        (COUNT(*) * 4)::FLOAT as rank_score,
        CASE WHEN COUNT(*) >= 3 THEN TRUE ELSE FALSE END as is_popular,
        COUNT(*)::INTEGER as match_count,
        0::INTEGER as highlight_start,
        v_query_length::INTEGER as highlight_end
    FROM jobs j
    WHERE j.location_normalized ILIKE v_normalized || '%'
      AND j.location IS NOT NULL
      AND (p_type = 'all' OR p_type = 'location')
    GROUP BY j.location, j.location_normalized
    ORDER BY COUNT(*) DESC, MAX(j.posted_at) DESC NULLS LAST
    LIMIT p_limit / 4;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Function: Get Trending Searches (Last 7 Days)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_trending_searches(
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    query TEXT,
    search_count BIGINT,
    trend_direction TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.query,
        ps.recent_count as search_count,
        CASE 
            WHEN ps.previous_count = 0 THEN 'new'::TEXT
            WHEN ps.recent_count > ps.previous_count * 1.5 THEN 'rising'::TEXT
            WHEN ps.recent_count > ps.previous_count THEN 'up'::TEXT
            WHEN ps.recent_count < ps.previous_count THEN 'down'::TEXT
            ELSE 'stable'::TEXT
        END as trend_direction
    FROM mv_popular_searches ps
    WHERE ps.recent_count >= 3
    ORDER BY ps.recent_count DESC, ps.search_count DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- Function: Track Search Query
-- Helper function to insert search analytics with proper normalization
-- ============================================================================

CREATE OR REPLACE FUNCTION track_search_query(
    p_query_text TEXT,
    p_query_normalized TEXT,
    p_results_count INTEGER DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_session_id TEXT DEFAULT NULL,
    p_filters_used JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO search_analytics (
        id,
        query_text,
        query_normalized,
        results_count,
        user_id,
        session_id,
        filters_used,
        created_at
    ) VALUES (
        gen_random_uuid(),
        p_query_text,
        COALESCE(p_query_normalized, LOWER(TRIM(p_query_text))),
        p_results_count,
        p_user_id,
        p_session_id,
        p_filters_used,
        NOW()
    )
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON MATERIALIZED VIEW mv_popular_searches IS 'Pre-aggregated popular search queries for fast autocomplete suggestions';
COMMENT ON FUNCTION get_smart_search_suggestions IS 'Returns ranked search suggestions combining popular searches and job database';
COMMENT ON FUNCTION get_trending_searches IS 'Returns trending searches from the last 7 days with trend direction';
COMMENT ON FUNCTION track_search_query IS 'Helper function to track search queries with proper normalization';
