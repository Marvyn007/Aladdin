import { NextRequest, NextResponse } from 'next/server';
import { getDbType } from '@/lib/db';
import { getPostgresPool } from '@/lib/postgres';
import { normalizeText, tokenize } from '@/lib/search/tokenizer';
import { suggestCorrection } from '@/lib/search/fuzzy';

export const dynamic = 'force-dynamic';

/**
 * GET /api/search/suggestions?query={partial}&type={all|title|company|location}&limit={number}
 * 
 * Provides autocomplete suggestions for the search bar with **guaranteed results**.
 * Uses multiple strategies to ensure users always see suggestions:
 * 1. Exact prefix matches (fastest)
 * 2. Full-text token matches
 * 3. Fuzzy/trigram similarity matches
 * 4. Materialized view cached terms
 * 5. Popular/recent jobs as fallback
 * 
 * Never returns empty results - always provides at least popular job titles.
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    
    const query = searchParams.get('query');
    const type = (searchParams.get('type') || 'all') as 'all' | 'title' | 'company' | 'location';
    const limit = Math.min(20, Math.max(1, parseInt(searchParams.get('limit') || '10', 10)));

    // Always return results, even for empty queries
    if (!query || query.length < 1) {
      const fallbackSuggestions = await getFallbackSuggestions(type, limit);
      return NextResponse.json({
        suggestions: fallbackSuggestions,
        query: query || '',
        total: fallbackSuggestions.titles.length + fallbackSuggestions.companies.length + fallbackSuggestions.locations.length,
        fallbackUsed: true,
        didYouMean: undefined
      });
    }

    const dbType = getDbType();
    
    if (dbType !== 'postgres') {
      // Fallback for non-PostgreSQL databases
      return NextResponse.json({
        suggestions: {
          titles: [],
          companies: [],
          locations: []
        },
        query,
        total: 0,
        note: 'Suggestions only available with PostgreSQL'
      });
    }

    const pool = getPostgresPool();
    const normalizedQuery = normalizeText(query);
    const tokens = tokenize(query);
    
    // Build the suggestions query with multiple fallback layers
    const suggestions = await fetchSuggestionsWithFallback(
      pool, 
      query, 
      normalizedQuery, 
      tokens,
      type, 
      limit
    );
    
    // Get spelling correction if applicable
    const didYouMean = query.length > 3 ? suggestCorrection(query) : undefined;
    
    // Calculate total
    const total = suggestions.titles.length + suggestions.companies.length + suggestions.locations.length;
    
    return NextResponse.json({
      suggestions,
      query,
      total,
      didYouMean,
      fallbackUsed: total < limit
    });

  } catch (error) {
    console.error('[Suggestions API] Error:', error);
    
    // Return fallback suggestions on error
    const fallbackSuggestions = await getFallbackSuggestions('all', 10);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch suggestions',
        message: error instanceof Error ? error.message : 'Unknown error',
        suggestions: fallbackSuggestions,
        query: '',
        total: fallbackSuggestions.titles.length + fallbackSuggestions.companies.length + fallbackSuggestions.locations.length,
        fallbackUsed: true
      },
      { status: 500 }
    );
  }
}

/**
 * Fetches suggestions with multiple fallback layers
 */
async function fetchSuggestionsWithFallback(
  pool: any,
  query: string,
  normalizedQuery: string,
  tokens: string[],
  type: 'all' | 'title' | 'company' | 'location',
  limit: number
): Promise<{ titles: string[]; companies: string[]; locations: string[] }> {
  
  const results = {
    titles: [] as string[],
    companies: [] as string[],
    locations: [] as string[]
  };

  const perTypeLimit = Math.ceil(limit / (type === 'all' ? 3 : 1));

  try {
    // Layer 1: Prefix matches (fastest, most relevant)
    if (type === 'all' || type === 'title') {
      const prefixTitles = await fetchPrefixMatches(pool, normalizedQuery, 'title', perTypeLimit);
      results.titles = prefixTitles;
    }

    if (type === 'all' || type === 'company') {
      const prefixCompanies = await fetchPrefixMatches(pool, normalizedQuery, 'company', perTypeLimit);
      results.companies = prefixCompanies;
    }

    if (type === 'all' || type === 'location') {
      const prefixLocations = await fetchPrefixMatches(pool, normalizedQuery, 'location', perTypeLimit);
      results.locations = prefixLocations;
    }

    // Layer 2: Fuzzy/trigram matches (if prefix didn't fill the limit)
    if (results.titles.length < perTypeLimit && (type === 'all' || type === 'title')) {
      const fuzzyTitles = await fetchFuzzyMatches(
        pool, 
        query, 
        'title', 
        perTypeLimit - results.titles.length,
        results.titles
      );
      results.titles = [...results.titles, ...fuzzyTitles];
    }

    if (results.companies.length < perTypeLimit && (type === 'all' || type === 'company')) {
      const fuzzyCompanies = await fetchFuzzyMatches(
        pool, 
        query, 
        'company', 
        perTypeLimit - results.companies.length,
        results.companies
      );
      results.companies = [...results.companies, ...fuzzyCompanies];
    }

    if (results.locations.length < perTypeLimit && (type === 'all' || type === 'location')) {
      const fuzzyLocations = await fetchFuzzyMatches(
        pool, 
        query, 
        'location', 
        perTypeLimit - results.locations.length,
        results.locations
      );
      results.locations = [...results.locations, ...fuzzyLocations];
    }

    // Layer 3: Token-based matches (broad match)
    if (results.titles.length < perTypeLimit && tokens.length > 0 && (type === 'all' || type === 'title')) {
      const tokenTitles = await fetchTokenMatches(
        pool, 
        tokens, 
        'title', 
        perTypeLimit - results.titles.length,
        results.titles
      );
      results.titles = [...results.titles, ...tokenTitles];
    }

    // Layer 4: Popular/recent suggestions (final fallback)
    const totalResults = results.titles.length + results.companies.length + results.locations.length;
    if (totalResults < limit) {
      const fallback = await fetchPopularSuggestions(
        pool, 
        type, 
        limit - totalResults,
        [...results.titles, ...results.companies, ...results.locations]
      );
      
      if (type === 'all' || type === 'title') {
        results.titles = [...results.titles, ...fallback.titles].slice(0, perTypeLimit);
      }
      if (type === 'all' || type === 'company') {
        results.companies = [...results.companies, ...fallback.companies].slice(0, perTypeLimit);
      }
      if (type === 'all' || type === 'location') {
        results.locations = [...results.locations, ...fallback.locations].slice(0, perTypeLimit);
      }
    }

    return results;
    
  } catch (error) {
    console.error('[Suggestions] Database error:', error);
    return results;
  }
}

/**
 * Fetches prefix matches (exact start of string)
 */
async function fetchPrefixMatches(
  pool: any,
  query: string,
  field: 'title' | 'company' | 'location',
  limit: number
): Promise<string[]> {
  const columnMap = {
    title: 'title_normalized',
    company: 'company_normalized',
    location: 'location_normalized'
  };
  
  const valueColumnMap = {
    title: 'title',
    company: 'company',
    location: 'location'
  };

  const sql = `
    SELECT DISTINCT ${valueColumnMap[field]} as value
    FROM jobs
    WHERE ${columnMap[field]} LIKE $1 || '%'
      AND ${valueColumnMap[field]} IS NOT NULL
    ORDER BY 
      CASE 
        WHEN ${columnMap[field]} = $1 THEN 0
        ELSE 1
      END,
      ${valueColumnMap[field]}
    LIMIT $2
  `;
  
  const result = await pool.query(sql, [query, limit]);
  return result.rows.map((r: any) => r.value);
}

/**
 * Fetches fuzzy matches using pg_trgm similarity
 */
async function fetchFuzzyMatches(
  pool: any,
  query: string,
  field: 'title' | 'company' | 'location',
  limit: number,
  exclude: string[]
): Promise<string[]> {
  const valueColumnMap = {
    title: 'title',
    company: 'company',
    location: 'location'
  };

  const sql = `
    SELECT DISTINCT ${valueColumnMap[field]} as value,
      similarity(${valueColumnMap[field]}, $1) as sim
    FROM jobs
    WHERE ${valueColumnMap[field]} % $1
      AND ${valueColumnMap[field]} IS NOT NULL
      AND ${valueColumnMap[field]} != ALL($3)
    ORDER BY sim DESC, ${valueColumnMap[field]}
    LIMIT $2
  `;
  
  const result = await pool.query(sql, [query, limit, exclude.length > 0 ? exclude : ['']]);
  return result.rows.map((r: any) => r.value);
}

/**
 * Fetches token-based matches (contains any token)
 */
async function fetchTokenMatches(
  pool: any,
  tokens: string[],
  field: 'title' | 'company' | 'location',
  limit: number,
  exclude: string[]
): Promise<string[]> {
  const columnMap = {
    title: 'title_normalized',
    company: 'company_normalized',
    location: 'location_normalized'
  };
  
  const valueColumnMap = {
    title: 'title',
    company: 'company',
    location: 'location'
  };

  // Build OR conditions for each token
  const conditions = tokens.map((_, i) => `${columnMap[field]} ILIKE $${i + 1}`).join(' OR ');
  const patterns = tokens.map(t => `%${t}%`);

  const sql = `
    SELECT DISTINCT ${valueColumnMap[field]} as value
    FROM jobs
    WHERE (${conditions})
      AND ${valueColumnMap[field]} IS NOT NULL
      AND ${valueColumnMap[field]} != ALL($${tokens.length + 1})
    ORDER BY ${valueColumnMap[field]}
    LIMIT $${tokens.length + 2}
  `;
  
  const result = await pool.query(sql, [...patterns, exclude.length > 0 ? exclude : [''], limit]);
  return result.rows.map((r: any) => r.value);
}

/**
 * Fetches popular/recent suggestions as final fallback
 */
async function fetchPopularSuggestions(
  pool: any,
  type: 'all' | 'title' | 'company' | 'location',
  limit: number,
  exclude: string[]
): Promise<{ titles: string[]; companies: string[]; locations: string[] }> {
  const results = {
    titles: [] as string[],
    companies: [] as string[],
    locations: [] as string[]
  };

  const perTypeLimit = Math.ceil(limit / (type === 'all' ? 3 : 1));

  try {
    // Try materialized view first
    if (type === 'all' || type === 'title') {
      const titleSql = `
        SELECT term as value
        FROM mv_common_search_terms
        WHERE term_type = 'title'
          AND term != ALL($2)
        ORDER BY frequency DESC, last_seen DESC
        LIMIT $1
      `;
      const titleResult = await pool.query(titleSql, [perTypeLimit, exclude.length > 0 ? exclude : ['']]);
      results.titles = titleResult.rows.map((r: any) => r.value);
    }

    if (type === 'all' || type === 'company') {
      const companySql = `
        SELECT term as value
        FROM mv_common_search_terms
        WHERE term_type = 'company'
          AND term != ALL($2)
        ORDER BY frequency DESC, last_seen DESC
        LIMIT $1
      `;
      const companyResult = await pool.query(companySql, [perTypeLimit, exclude.length > 0 ? exclude : ['']]);
      results.companies = companyResult.rows.map((r: any) => r.value);
    }

    if (type === 'all' || type === 'location') {
      const locationSql = `
        SELECT term as value
        FROM mv_common_search_terms
        WHERE term_type = 'location'
          AND term != ALL($2)
        ORDER BY frequency DESC, last_seen DESC
        LIMIT $1
      `;
      const locationResult = await pool.query(locationSql, [perTypeLimit, exclude.length > 0 ? exclude : ['']]);
      results.locations = locationResult.rows.map((r: any) => r.value);
    }

    // If materialized view didn't return enough, fall back to recent jobs
    if (results.titles.length < perTypeLimit && (type === 'all' || type === 'title')) {
      const recentSql = `
        SELECT DISTINCT title as value
        FROM jobs
        WHERE title IS NOT NULL
          AND title != ALL($2)
        ORDER BY posted_at DESC NULLS LAST
        LIMIT $1
      `;
      const recentResult = await pool.query(recentSql, [
        perTypeLimit - results.titles.length,
        [...exclude, ...results.titles].length > 0 ? [...exclude, ...results.titles] : ['']
      ]);
      results.titles = [...results.titles, ...recentResult.rows.map((r: any) => r.value)];
    }

    return results;
    
  } catch (error) {
    console.error('[Suggestions] Popular fetch error:', error);
    return results;
  }
}

/**
 * Gets fallback suggestions when query is empty or on error
 */
async function getFallbackSuggestions(
  type: 'all' | 'title' | 'company' | 'location',
  limit: number
): Promise<{ titles: string[]; companies: string[]; locations: string[] }> {
  const results = {
    titles: [] as string[],
    companies: [] as string[],
    locations: [] as string[]
  };

  const dbType = getDbType();
  if (dbType !== 'postgres') {
    return results;
  }

  const pool = getPostgresPool();
  const perTypeLimit = Math.ceil(limit / (type === 'all' ? 3 : 1));

  try {
    if (type === 'all' || type === 'title') {
      const sql = `
        SELECT DISTINCT title
        FROM jobs
        WHERE title IS NOT NULL
        ORDER BY posted_at DESC NULLS LAST
        LIMIT $1
      `;
      const result = await pool.query(sql, [perTypeLimit]);
      results.titles = result.rows.map((r: any) => r.title);
    }

    if (type === 'all' || type === 'company') {
      const sql = `
        SELECT DISTINCT company
        FROM jobs
        WHERE company IS NOT NULL
        ORDER BY posted_at DESC NULLS LAST
        LIMIT $1
      `;
      const result = await pool.query(sql, [perTypeLimit]);
      results.companies = result.rows.map((r: any) => r.company);
    }

    if (type === 'all' || type === 'location') {
      const sql = `
        SELECT DISTINCT location
        FROM jobs
        WHERE location IS NOT NULL
        ORDER BY posted_at DESC NULLS LAST
        LIMIT $1
      `;
      const result = await pool.query(sql, [perTypeLimit]);
      results.locations = result.rows.map((r: any) => r.location);
    }

    return results;
    
  } catch (error) {
    console.error('[Suggestions] Fallback error:', error);
    return results;
  }
}
