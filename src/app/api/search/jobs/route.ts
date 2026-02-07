import { NextRequest, NextResponse } from 'next/server';
import { searchJobsEnhanced, suggestCorrection, generateAlternatives } from '@/lib/search/enhanced';
import { searchJobs } from '@/lib/search';
import type { SearchFilters } from '@/lib/search/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/search/jobs
 * Enhanced search endpoint implementing the multi-layer search pipeline
 * 
 * This endpoint **ALWAYS** returns relevant results, even if no exact matches exist.
 * It uses a 6-layer fallback system:
 * 1. Exact & Prefix Matches
 * 2. Full-Text Search (PostgreSQL FTS)
 * 3. Fuzzy Search (pg_trgm)
 * 4. Semantic Search (pgvector)
 * 5. Broad Token Match
 * 6. Default Results (Recent jobs)
 * 
 * Request Body:
 * {
 *   query: string,
 *   page?: number (default: 1),
 *   limit?: number (default: 50, max: 100),
 *   filters?: {
 *     location?: string,
 *     remoteOnly?: boolean,
 *     datePosted?: '24h' | '7d' | '30d' | 'all'
 *   },
 *   useEnhanced?: boolean (default: true) - Use new enhanced search
 * }
 * 
 * Response:
 * {
 *   jobs: SearchResultJob[],
 *   pagination: { page, limit, total, totalPages },
 *   query: { original, normalized, embedding, queryType },
 *   timing: { stage1_ms, stage2_ms, total_ms },
 *   didYouMean?: string,  // Spelling suggestion
 *   fallbackUsed: boolean,  // Whether fallback layers were used
 *   layersUsed: string[],  // Which search layers were activated
 *   totalCandidates: number  // Total candidates before ranking
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { query, page, limit, filters, useEnhanced = true } = body;

    // Validate required fields
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { error: 'Query is required and must be a string' },
        { status: 400 }
      );
    }

    // Validate and sanitize pagination
    const sanitizedPage = Math.max(1, page || 1);
    const sanitizedLimit = Math.min(100, Math.max(1, limit || 50));

    // Validate filters
    const sanitizedFilters: SearchFilters = {};
    if (filters) {
      if (filters.location && typeof filters.location === 'string') {
        sanitizedFilters.location = filters.location;
      }
      if (filters.remoteOnly === true) {
        sanitizedFilters.remoteOnly = true;
      }
      if (filters.datePosted && ['24h', '7d', '30d', 'all'].includes(filters.datePosted)) {
        sanitizedFilters.datePosted = filters.datePosted;
      }
      if (filters.company && typeof filters.company === 'string') {
        sanitizedFilters.company = filters.company;
      }
      if (filters.title && typeof filters.title === 'string') {
        sanitizedFilters.title = filters.title;
      }
    }

    // Perform search using enhanced or legacy system
    const searchFunction = useEnhanced ? searchJobsEnhanced : searchJobs;

    console.log('[Search API] Request received:', {
      query: query.trim(),
      page: sanitizedPage,
      limit: sanitizedLimit,
      filters: sanitizedFilters,
      useEnhanced,
    });

    const results = await searchFunction({
      query: query.trim(),
      page: sanitizedPage,
      limit: sanitizedLimit,
      filters: sanitizedFilters,
    });

    console.log('[Search API] Results:', {
      jobsCount: results.jobs?.length || 0,
      totalCandidates: (results as any).totalCandidates,
      layersUsed: (results as any).layersUsed,
      fallbackUsed: results.fallbackUsed,
      didYouMean: results.didYouMean,
      timing: results.timing,
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Search API] Error:', error);

    // Return user-friendly error with empty results
    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        jobs: [],
        pagination: {
          page: 1,
          limit: 50,
          total: 0,
          totalPages: 0
        },
        query: {
          original: '',
          normalized: '',
          embedding: [],
          queryType: 'compound'
        },
        timing: {
          stage1_ms: 0,
          stage2_ms: 0,
          total_ms: 0
        },
        fallbackUsed: true,
        layersUsed: ['error'],
        totalCandidates: 0
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/search/jobs?query={query}&page={page}&limit={limit}&location={location}&remoteOnly={bool}&useEnhanced={bool}
 * Alternative GET endpoint for simpler queries
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const query = searchParams.get('query');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const location = searchParams.get('location');
    const remoteOnly = searchParams.get('remoteOnly') === 'true';
    const datePosted = searchParams.get('datePosted') as '24h' | '7d' | '30d' | 'all' | null;
    const useEnhanced = searchParams.get('useEnhanced') !== 'false'; // Default to true

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    const filters: SearchFilters = {};
    if (location) filters.location = location;
    if (remoteOnly) filters.remoteOnly = true;
    if (datePosted && ['24h', '7d', '30d', 'all'].includes(datePosted)) {
      filters.datePosted = datePosted;
    }

    const searchFunction = useEnhanced ? searchJobsEnhanced : searchJobs;
    const results = await searchFunction({
      query: query.trim(),
      page,
      limit,
      filters,
    });

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Search API] GET Error:', error);

    return NextResponse.json(
      {
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
