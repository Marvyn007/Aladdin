import { NextRequest, NextResponse } from 'next/server';
import { getDbType } from '@/lib/db';
import { getPostgresPool } from '@/lib/postgres';
import { normalizeText, tokenize } from '@/lib/search/tokenizer';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/smart-suggestions?query={partial}&type={all|title|company|location}&limit={number}
 * 
 * Enhanced autocomplete with:
 * 1. Smart ranking based on search popularity
 * 2. Autofill suggestions (highlight matching portion)
 * 3. Trending/popular badges
 * 4. Hybrid results from both jobs database and search analytics
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get('query') || '';
    const type = (searchParams.get('type') || 'all') as 'all' | 'title' | 'company' | 'location';
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));
    const includeAnalytics = searchParams.get('analytics') !== 'false'; // Default true

    const dbType = getDbType();
    
    if (dbType !== 'postgres') {
      return NextResponse.json({
        suggestions: [],
        autofill: null,
        trending: [],
        query,
        total: 0,
        note: 'Smart suggestions only available with PostgreSQL'
      });
    }

    const pool = getPostgresPool();
    const normalizedQuery = normalizeText(query);
    
    // Fetch smart suggestions with ranking
    const suggestions = await fetchSmartSuggestions(
      pool, 
      query,
      normalizedQuery,
      type, 
      limit,
      includeAnalytics
    );
    
    // Get autofill suggestion (best match for the query)
    const autofill = suggestions.length > 0 ? suggestions[0].text : null;
    
    // Get trending searches (most popular in last 7 days)
    const trending = includeAnalytics ? await fetchTrendingSearches(pool, type, 5) : [];
    
    return NextResponse.json({
      suggestions: suggestions.map(s => ({
        text: s.text,
        type: s.type,
        rank: s.rank,
        isPopular: s.isPopular,
        isExactMatch: s.isExactMatch,
        matchCount: s.matchCount,
        highlightStart: s.highlightStart,
        highlightEnd: s.highlightEnd
      })),
      autofill,
      autofillType: suggestions.length > 0 ? suggestions[0].type : null,
      trending,
      query,
      total: suggestions.length
    });

  } catch (error) {
    console.error('[Smart Suggestions API] Error:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch smart suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestions: [],
        autofill: null,
        trending: [],
        query: '',
        total: 0
      },
      { status: 500 }
    );
  }
}

interface SmartSuggestion {
  text: string;
  type: 'title' | 'company' | 'location';
  rank: number;
  isPopular: boolean;
  isExactMatch: boolean;
  matchCount: number;
  highlightStart: number;
  highlightEnd: number;
}

/**
 * Fetches smart suggestions combining job data and search analytics
 */
async function fetchSmartSuggestions(
  pool: any,
  query: string,
  normalizedQuery: string,
  type: 'all' | 'title' | 'company' | 'location',
  limit: number,
  includeAnalytics: boolean
): Promise<SmartSuggestion[]> {
  
  const results: SmartSuggestion[] = [];
  const perTypeLimit = Math.ceil(limit / (type === 'all' ? 3 : 1));

  try {
    // Strategy 1: Get suggestions from search analytics (popular searches)
    if (includeAnalytics && query.length >= 2) {
      const popularSuggestions = await fetchPopularSearchQueries(
        pool, 
        query, 
        type, 
        perTypeLimit
      );
      results.push(...popularSuggestions);
    }

    // Strategy 2: Get suggestions from jobs database with frequency ranking
    const jobSuggestions = await fetchJobSuggestionsWithRanking(
      pool,
      query,
      normalizedQuery,
      type,
      perTypeLimit,
      results.map(r => r.text.toLowerCase())
    );
    
    // Merge and deduplicate, keeping highest ranked
    for (const suggestion of jobSuggestions) {
      const exists = results.find(r => 
        r.text.toLowerCase() === suggestion.text.toLowerCase() &&
        r.type === suggestion.type
      );
      if (!exists) {
        results.push(suggestion);
      }
    }

    // Sort by rank (descending) and return top results
    return results
      .sort((a, b) => b.rank - a.rank)
      .slice(0, limit)
      .map(s => ({
        ...s,
        highlightStart: 0,
        highlightEnd: query.length
      }));

  } catch (error) {
    console.error('[Smart Suggestions] Error:', error);
    return results;
  }
}

/**
 * Fetches popular search queries from analytics
 */
async function fetchPopularSearchQueries(
  pool: any,
  query: string,
  type: 'all' | 'title' | 'company' | 'location',
  limit: number
): Promise<SmartSuggestion[]> {
  const results: SmartSuggestion[] = [];
  const normalizedQuery = normalizeText(query);
  
  try {
    // Get popular searches from analytics that match the query
    const sql = `
      WITH popular_searches AS (
        SELECT 
          query_normalized as term,
          COUNT(*) as search_count,
          COUNT(DISTINCT user_id) as unique_users,
          MAX(created_at) as last_searched
        FROM search_analytics
        WHERE query_normalized ILIKE $1 || '%'
          AND created_at > NOW() - INTERVAL '30 days'
          AND query_normalized IS NOT NULL
        GROUP BY query_normalized
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC, MAX(created_at) DESC
        LIMIT $2
      )
      SELECT 
        term,
        search_count,
        unique_users,
        CASE 
          WHEN search_count >= 10 THEN TRUE 
          ELSE FALSE 
        END as is_trending
      FROM popular_searches
    `;
    
    const result = await pool.query(sql, [normalizedQuery, limit * 2]);
    
    for (const row of result.rows) {
      // Determine type based on content
      let suggestionType: 'title' | 'company' | 'location' = 'title';
      
      // Simple heuristic to determine type
      const term = row.term.toLowerCase();
      if (type !== 'all') {
        suggestionType = type;
      } else {
        // Check if it looks like a company or location
        const companyIndicators = ['inc', 'corp', 'llc', 'ltd', 'co.', 'company'];
        const locationIndicators = ['remote', 'ny', 'ca', 'tx', 'usa', 'uk', 'canada'];
        
        if (companyIndicators.some(ind => term.includes(ind))) {
          suggestionType = 'company';
        } else if (locationIndicators.some(ind => term.includes(ind))) {
          suggestionType = 'location';
        }
      }
      
      results.push({
        text: row.term,
        type: suggestionType,
        rank: Math.min(100, row.search_count * 5 + row.unique_users * 2), // Popularity score
        isPopular: row.search_count >= 5,
        isExactMatch: row.term.toLowerCase() === normalizedQuery,
        matchCount: parseInt(row.search_count),
        highlightStart: 0,
        highlightEnd: query.length
      });
    }
    
  } catch (error) {
    console.error('[Popular Searches] Error:', error);
  }
  
  return results;
}

/**
 * Fetches job-based suggestions with frequency ranking
 */
async function fetchJobSuggestionsWithRanking(
  pool: any,
  query: string,
  normalizedQuery: string,
  type: 'all' | 'title' | 'company' | 'location',
  limit: number,
  excludeTerms: string[]
): Promise<SmartSuggestion[]> {
  const results: SmartSuggestion[] = [];

  try {
    // Fetch titles with frequency ranking
    if (type === 'all' || type === 'title') {
      const titleSql = `
        WITH title_freq AS (
          SELECT 
            title,
            title_normalized,
            COUNT(*) as job_count,
            MAX(posted_at) as last_posted
          FROM jobs
          WHERE title_normalized ILIKE $1 || '%'
            AND title IS NOT NULL
            AND ($3 = '{}'::text[] OR title_normalized NOT IN (
              SELECT LOWER(unnest($3))
            ))
          GROUP BY title, title_normalized
          ORDER BY 
            CASE 
              WHEN title_normalized = $2 THEN 100
              ELSE COUNT(*) * 2
            END DESC,
            MAX(posted_at) DESC NULLS LAST
          LIMIT $4
        )
        SELECT 
          title as text,
          job_count,
          CASE WHEN job_count >= 5 THEN TRUE ELSE FALSE END as is_common
        FROM title_freq
      `;
      
      const titleResult = await pool.query(
        titleSql, 
        [normalizedQuery, normalizedQuery, excludeTerms, limit]
      );
      
      for (const row of titleResult.rows) {
        results.push({
          text: row.text,
          type: 'title',
          rank: Math.min(90, parseInt(row.job_count) * 3),
          isPopular: row.is_common,
          isExactMatch: row.text.toLowerCase() === query.toLowerCase(),
          matchCount: parseInt(row.job_count),
          highlightStart: 0,
          highlightEnd: query.length
        });
      }
    }

    // Fetch companies with frequency ranking
    if (type === 'all' || type === 'company') {
      const companySql = `
        WITH company_freq AS (
          SELECT 
            company,
            company_normalized,
            COUNT(*) as job_count,
            MAX(posted_at) as last_posted
          FROM jobs
          WHERE company_normalized ILIKE $1 || '%'
            AND company IS NOT NULL
            AND ($3 = '{}'::text[] OR company_normalized NOT IN (
              SELECT LOWER(unnest($3))
            ))
          GROUP BY company, company_normalized
          ORDER BY COUNT(*) DESC, MAX(posted_at) DESC NULLS LAST
          LIMIT $4
        )
        SELECT 
          company as text,
          job_count,
          CASE WHEN job_count >= 3 THEN TRUE ELSE FALSE END as is_common
        FROM company_freq
      `;
      
      const companyResult = await pool.query(
        companySql, 
        [normalizedQuery, excludeTerms, limit]
      );
      
      for (const row of companyResult.rows) {
        results.push({
          text: row.text,
          type: 'company',
          rank: Math.min(85, parseInt(row.job_count) * 4),
          isPopular: row.is_common,
          isExactMatch: row.text.toLowerCase() === query.toLowerCase(),
          matchCount: parseInt(row.job_count),
          highlightStart: 0,
          highlightEnd: query.length
        });
      }
    }

    // Fetch locations with frequency ranking
    if (type === 'all' || type === 'location') {
      const locationSql = `
        WITH location_freq AS (
          SELECT 
            location,
            location_normalized,
            COUNT(*) as job_count,
            MAX(posted_at) as last_posted
          FROM jobs
          WHERE location_normalized ILIKE $1 || '%'
            AND location IS NOT NULL
            AND ($3 = '{}'::text[] OR location_normalized NOT IN (
              SELECT LOWER(unnest($3))
            ))
          GROUP BY location, location_normalized
          ORDER BY COUNT(*) DESC, MAX(posted_at) DESC NULLS LAST
          LIMIT $4
        )
        SELECT 
          location as text,
          job_count,
          CASE WHEN job_count >= 3 THEN TRUE ELSE FALSE END as is_common
        FROM location_freq
      `;
      
      const locationResult = await pool.query(
        locationSql, 
        [normalizedQuery, excludeTerms, limit]
      );
      
      for (const row of locationResult.rows) {
        results.push({
          text: row.text,
          type: 'location',
          rank: Math.min(80, parseInt(row.job_count) * 4),
          isPopular: row.is_common,
          isExactMatch: row.text.toLowerCase() === query.toLowerCase(),
          matchCount: parseInt(row.job_count),
          highlightStart: 0,
          highlightEnd: query.length
        });
      }
    }

  } catch (error) {
    console.error('[Job Suggestions] Error:', error);
  }

  return results;
}

/**
 * Fetches trending searches from the last 7 days
 */
async function fetchTrendingSearches(
  pool: any,
  type: 'all' | 'title' | 'company' | 'location',
  limit: number
): Promise<Array<{ text: string; type: string; count: number }>> {
  try {
    const sql = `
      SELECT 
        query_normalized as text,
        COUNT(*) as count
      FROM search_analytics
      WHERE created_at > NOW() - INTERVAL '7 days'
        AND query_normalized IS NOT NULL
        AND LENGTH(query_normalized) > 2
      GROUP BY query_normalized
      HAVING COUNT(*) >= 3
      ORDER BY COUNT(*) DESC
      LIMIT $1
    `;
    
    const result = await pool.query(sql, [limit]);
    
    return result.rows.map((row: any) => ({
      text: row.text,
      type: 'trending',
      count: parseInt(row.count)
    }));
    
  } catch (error) {
    console.error('[Trending Searches] Error:', error);
    return [];
  }
}

/**
 * POST endpoint to track search queries for analytics
 * Called automatically when user performs a search
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, userId, resultsCount, filters } = body;
    
    if (!query || query.length < 2) {
      return NextResponse.json({ success: false, error: 'Query too short' });
    }

    const dbType = getDbType();
    if (dbType !== 'postgres') {
      return NextResponse.json({ success: false, error: 'Analytics only available with PostgreSQL' });
    }

    const pool = getPostgresPool();
    
    // Insert into search_analytics
    const sql = `
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
        $1,
        $2,
        $3,
        $4,
        $5,
        $6,
        NOW()
      )
    `;
    
    await pool.query(sql, [
      query,
      normalizeText(query),
      resultsCount || 0,
      userId || null,
      request.headers.get('x-session-id') || null,
      filters ? JSON.stringify(filters) : null
    ]);

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('[Analytics Tracking] Error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to track search' },
      { status: 500 }
    );
  }
}
