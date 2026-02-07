/**
 * Enhanced Search Module
 * 
 * This module provides a bulletproof search system that **ALWAYS** returns relevant results.
 * It implements multiple fallback layers to ensure users never see "No results found".
 * 
 * Architecture:
 * 1. Layer 1: Exact & Prefix Matches (PostgreSQL ILIKE + normalized fields)
 * 2. Layer 2: Full-Text Search (PostgreSQL tsvector/tsquery with weighted ranking)
 * 3. Layer 3: Fuzzy Search (pg_trgm similarity)
 * 4. Layer 4: Semantic Search (pgvector cosine similarity)
 * 5. Layer 5: Broad Match (Partial token matching)
 * 6. Layer 6: Default Results (Most recent/popular jobs)
 * 
 * Features:
 * - Hybrid scoring combining keyword relevance + semantic similarity
 * - Query intent classification for better ranking
 * - Automatic spelling correction ("Did you mean?")
 * - Prefix matching for real-time autocomplete
 * - Configurable minimum results guarantee
 */

import { getDbType } from '@/lib/db';
import { getPostgresPool } from '@/lib/postgres';
import { prisma } from '@/lib/prisma';
import type {
  SearchQuery,
  SearchResponse,
  SearchResultJob,
  SearchFilters,
  QueryType,
  MatchCategory
} from './types';
import {
  normalizeText,
  tokenize,
  classifyQuery,
  createTokenizedQuery,
  createExpandedTokenizedQuery,
  extractPhrases
} from './tokenizer';
import {
  scoreJobResult,
  detectMatchCategories,
  generateMatchDetails,
  generateMatchSnippet,
  isRelevantScore,
  SCORE_THRESHOLDS,
  calculateTotalScore,
  getWeightsForQueryType
} from './scoring';
import {
  getQueryEmbedding,
  SIMILARITY_THRESHOLDS,
  cosineSimilarity,
  expandQueryForSemantic
} from './semantic';
import {
  suggestCorrection,
  generateAlternatives,
  trigramSimilarity,
  FUZZY_THRESHOLDS
} from './fuzzy';

// ============================================================================
// Configuration
// ============================================================================

const SEARCH_CONFIG = {
  // Minimum results to return (guarantee)
  MIN_RESULTS_GUARANTEE: 10,

  // Maximum candidates for each layer
  LAYER_LIMITS: {
    EXACT: 100,
    FULL_TEXT: 200,
    FUZZY: 300,
    SEMANTIC: 500,
    BROAD: 200,
    DEFAULT: 50,
  },

  // Scoring weights for hybrid search
  HYBRID_WEIGHTS: {
    TEXT_RELEVANCE: 0.6,    // PostgreSQL FTS score weight
    SEMANTIC_SIMILARITY: 0.4, // pgvector cosine similarity weight
  },

  // Thresholds for including results from each layer
  THRESHOLDS: {
    EXACT_MIN_SCORE: 500,
    FULL_TEXT_MIN_SCORE: 0.1,  // FTS returns 0-1 typically
    FUZZY_MIN_SIMILARITY: 0.3,
    SEMANTIC_MIN_SIMILARITY: 0.4,
    BROAD_MIN_TOKENS: 1,
  },

  // Pagination
  MAX_RESULTS: 100,
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
};

// ============================================================================
// Main Search Function - Guaranteed Results
// ============================================================================

/**
 * Enhanced search that **ALWAYS** returns relevant results
 * Uses multiple fallback layers to ensure users never see empty results
 */
export async function searchJobsEnhanced(params: SearchQuery): Promise<SearchResponse> {
  const startTime = Date.now();

  const query = params.query?.trim() || '';
  const page = Math.max(1, params.page || SEARCH_CONFIG.DEFAULT_PAGE);
  const limit = Math.min(
    SEARCH_CONFIG.MAX_RESULTS,
    Math.max(1, params.limit || SEARCH_CONFIG.DEFAULT_LIMIT)
  );
  const filters = params.filters || {};

  // Classify query for better ranking
  const classification = classifyQuery(query);
  const tokenized = createExpandedTokenizedQuery(query);

  console.log('[Enhanced Search] Starting search:', {
    query,
    classification: classification.type,
    tokens: tokenized.tokens,
    expandedTokens: tokenized.expandedTokens,
    primaryExpansion: tokenized.primaryExpansion,
    filters,
  });

  // Track which layers were used
  const layersUsed: string[] = [];
  let fallbackUsed = false;
  let didYouMean: string | undefined;

  // Get query embedding for semantic search (cached)
  const queryEmbedding = query ? await getQueryEmbedding(query) : null;
  console.log('[Enhanced Search] Query embedding:', queryEmbedding ? `${queryEmbedding.length} dimensions` : 'null');

  // Collect all candidates from all layers
  const allCandidates = new Map<string, RawCandidate>();

  // ==========================================================================
  // LAYER 1: Exact & Prefix Matches (Highest Priority)
  // ==========================================================================
  const layer1Start = Date.now();
  const exactMatches = await searchExactAndPrefix(query, filters, params.userId);
  layersUsed.push('exact_prefix');
  console.log('[Enhanced Search] Layer 1 (Exact/Prefix):', exactMatches.length, 'matches');

  for (const match of exactMatches) {
    allCandidates.set(match.id, {
      ...match,
      layer: 'exact',
      layerScore: (match as any).score || match.layerScore || 0,
    });
  }

  // ==========================================================================
  // LAYER 2: Full-Text Search (PostgreSQL FTS)
  // ==========================================================================
  if (allCandidates.size < SEARCH_CONFIG.MIN_RESULTS_GUARANTEE) {
    const ftsMatches = await searchFullText(query, tokenized.tokens, filters, params.userId);
    layersUsed.push('full_text');
    console.log('[Enhanced Search] Layer 2 (FTS):', ftsMatches.length, 'matches. Total candidates:', allCandidates.size);

    for (const match of ftsMatches) {
      if (!allCandidates.has(match.id)) {
        allCandidates.set(match.id, {
          ...match,
          layer: 'fts',
          layerScore: (match as any).score || match.layerScore || 0,
        });
      }
    }
  }

  // ==========================================================================
  // LAYER 3: Fuzzy Search (pg_trgm)
  // ==========================================================================
  if (allCandidates.size < SEARCH_CONFIG.MIN_RESULTS_GUARANTEE) {
    fallbackUsed = true;
    const fuzzyMatches = await searchFuzzy(query, filters, params.userId);
    layersUsed.push('fuzzy');
    console.log('[Enhanced Search] Layer 3 (Fuzzy):', fuzzyMatches.length, 'matches. Total candidates:', allCandidates.size);

    // Get spelling suggestion
    didYouMean = suggestCorrection(query);

    for (const match of fuzzyMatches) {
      if (!allCandidates.has(match.id)) {
        allCandidates.set(match.id, {
          ...match,
          layer: 'fuzzy',
          layerScore: (match as any).score || match.layerScore || 0,
        });
      }
    }
  }

  // ==========================================================================
  // LAYER 4: Semantic Search (pgvector)
  // ==========================================================================
  if (allCandidates.size < SEARCH_CONFIG.MIN_RESULTS_GUARANTEE && queryEmbedding) {
    fallbackUsed = true;
    const semanticMatches = await searchSemantic(query, queryEmbedding, filters, params.userId);
    layersUsed.push('semantic');
    console.log('[Enhanced Search] Layer 4 (Semantic):', semanticMatches.length, 'matches. Total candidates:', allCandidates.size);

    for (const match of semanticMatches) {
      if (!allCandidates.has(match.id)) {
        allCandidates.set(match.id, {
          ...match,
          layer: 'semantic',
          layerScore: (match as any).score || match.layerScore || 0,
        });
      }
    }
  }

  // ==========================================================================
  // LAYER 5: Broad Token Match (Partial matching with synonym expansion)
  // ==========================================================================
  if (allCandidates.size < SEARCH_CONFIG.MIN_RESULTS_GUARANTEE) {
    fallbackUsed = true;
    // Use expanded tokens which include synonyms for better coverage
    const tokensToMatch = tokenized.expandedTokens || tokenized.tokens;
    console.log('[Enhanced Search] Layer 5 (Broad) using tokens:', tokensToMatch);
    const broadMatches = await searchBroadMatch(tokensToMatch, filters, params.userId);
    layersUsed.push('broad');
    console.log('[Enhanced Search] Layer 5 (Broad):', broadMatches.length, 'matches. Total candidates:', allCandidates.size);

    for (const match of broadMatches) {
      if (!allCandidates.has(match.id)) {
        allCandidates.set(match.id, {
          ...match,
          layer: 'broad',
          layerScore: (match as any).score || match.layerScore || 0,
        });
      }
    }
  }

  // ==========================================================================
  // LAYER 6: Default Results (Last Resort - Always has results)
  // ==========================================================================
  if (allCandidates.size < SEARCH_CONFIG.MIN_RESULTS_GUARANTEE) {
    fallbackUsed = true;
    const defaultMatches = await searchDefaultResults(filters, params.userId);
    layersUsed.push('default');
    console.log('[Enhanced Search] Layer 6 (Default):', defaultMatches.length, 'matches. Total candidates:', allCandidates.size);

    for (const match of defaultMatches) {
      if (!allCandidates.has(match.id)) {
        allCandidates.set(match.id, {
          ...match,
          layer: 'default',
          layerScore: (match as any).score || match.layerScore || 0,
        });
      }
    }
  }

  const layerDuration = Date.now() - startTime;

  // ==========================================================================
  // Score and Rank All Candidates
  // ==========================================================================
  const scoringStart = Date.now();

  console.log('[Enhanced Search] Scoring', allCandidates.size, 'candidates...');

  let results = await scoreAndRankCandidatesEnhanced(
    Array.from(allCandidates.values()),
    query,
    tokenized.tokens,
    classification.type,
    queryEmbedding
  );

  console.log('[Enhanced Search] After scoring:', results.length, 'results');

  // Always ensure we have at least some results
  if (results.length === 0) {
    console.log('[Enhanced Search] No results after scoring! Trying emergency fallback...');
    results = await getEmergencyResults(filters, params.userId);
    fallbackUsed = true;
    layersUsed.push('emergency');
    console.log('[Enhanced Search] Emergency results:', results.length);
  }

  const totalResults = results.length;
  const offset = (page - 1) * limit;
  results = results.slice(offset, offset + limit);

  console.log('[Enhanced Search] Final results:', results.length, 'of', totalResults, 'total');

  const scoringDuration = Date.now() - scoringStart;
  const totalDuration = Date.now() - startTime;

  // ==========================================================================
  // Build Response
  // ==========================================================================
  return {
    jobs: results,
    pagination: {
      page,
      limit,
      total: totalResults,
      totalPages: Math.ceil(totalResults / limit),
    },
    query: {
      original: params.query,
      normalized: tokenized.normalized,
      embedding: queryEmbedding || [],
      queryType: classification.type,
    },
    timing: {
      stage1_ms: layerDuration,
      stage2_ms: scoringDuration,
      total_ms: totalDuration,
    },
    didYouMean,
    fallbackUsed,
    layersUsed,
    totalCandidates: allCandidates.size,
  };
}

// ============================================================================
// Search Layer Implementations
// ============================================================================

interface RawCandidate {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  title_normalized: string | null;
  company_normalized: string | null;
  location_normalized: string | null;
  job_description_plain: string | null;
  posted_at: Date | null;
  fetched_at: Date | null;
  source_url: string;
  content_hash: string | null;
  embedding: number[] | null;
  layer: string;
  layerScore: number;
}

/**
 * Layer 1: Exact and Prefix Matches
 * Fastest layer - uses indexed normalized fields
 */
async function searchExactAndPrefix(
  query: string,
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  console.log('[Enhanced Search] Layer 1 - dbType:', dbType, '| query:', query);

  if (dbType !== 'postgres' || !query) {
    console.log('[Enhanced Search] Layer 1 - Skipping:', dbType !== 'postgres' ? 'Not postgres' : 'Empty query');
    return [];
  }

  const pool = getPostgresPool();
  const normalizedQuery = normalizeText(query);
  console.log('[Enhanced Search] Layer 1 - normalizedQuery:', normalizedQuery);

  try {
    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        CASE 
          WHEN j.title_normalized = $1 THEN 1000
          WHEN j.title_normalized LIKE $2 THEN 900
          WHEN j.company_normalized = $1 THEN 800
          WHEN j.company_normalized LIKE $2 THEN 700
          WHEN j.location_normalized = $1 THEN 600
          WHEN j.location_normalized LIKE $2 THEN 500
          ELSE 400
        END as score
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        j.title_normalized = $1
        OR j.title_normalized LIKE $2
        OR j.company_normalized = $1
        OR j.company_normalized LIKE $2
        OR j.location_normalized = $1
        OR j.location_normalized LIKE $2
        ${buildFilterClauses(filters, 3)}
      ORDER BY score DESC
      LIMIT $${getNextParamIndex(filters, 3)}
    `;

    const values = [
      normalizedQuery,
      `${normalizedQuery}%`,
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.EXACT,
    ];

    console.log('[Enhanced Search] Layer 1 - Executing query with values:', values);

    const result = await pool.query(sql, values);
    console.log('[Enhanced Search] Layer 1 - Query returned', result.rows.length, 'rows');

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      title_normalized: row.title_normalized,
      company_normalized: row.company_normalized,
      location_normalized: row.location_normalized,
      job_description_plain: row.job_description_plain,
      posted_at: row.posted_at,
      fetched_at: row.fetched_at,
      source_url: row.source_url,
      content_hash: row.content_hash,
      embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
      layer: 'exact',
      layerScore: row.score,
    }));

  } catch (error) {
    console.error('[Search] Layer 1 error:', error);
    return [];
  }
}

/**
 * Layer 2: Full-Text Search with weighted ranking
 * Uses PostgreSQL tsvector/tsquery for fast text search
 */
async function searchFullText(
  query: string,
  tokens: string[],
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  if (dbType !== 'postgres' || !query) return [];

  const pool = getPostgresPool();

  try {
    // Build tsquery with AND logic for better precision
    const tsQuery = tokens.join(' & ');

    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        ts_rank_cd(
          setweight(to_tsvector('simple', COALESCE(j.title, '')), 'A') ||
          setweight(to_tsvector('simple', COALESCE(j.company, '')), 'B') ||
          setweight(to_tsvector('simple', COALESCE(j.location, '')), 'C') ||
          setweight(to_tsvector('simple', COALESCE(j.job_description_plain, '')), 'D'),
          plainto_tsquery('simple', $1),
          32
        ) as score
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        to_tsvector('simple', 
          COALESCE(j.title, '') || ' ' ||
          COALESCE(j.company, '') || ' ' ||
          COALESCE(j.location, '') || ' ' ||
          COALESCE(j.job_description_plain, '')
        ) @@ plainto_tsquery('simple', $1)
        ${buildFilterClauses(filters, 2)}
      ORDER BY score DESC
      LIMIT $${getNextParamIndex(filters, 2)}
    `;

    const values = [
      query,
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.FULL_TEXT,
    ];

    const result = await pool.query(sql, values);

    return result.rows
      .filter(row => row.score >= SEARCH_CONFIG.THRESHOLDS.FULL_TEXT_MIN_SCORE)
      .map(row => ({
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        title_normalized: row.title_normalized,
        company_normalized: row.company_normalized,
        location_normalized: row.location_normalized,
        job_description_plain: row.job_description_plain,
        posted_at: row.posted_at,
        fetched_at: row.fetched_at,
        source_url: row.source_url,
        content_hash: row.content_hash,
        embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
        layer: 'fts',
        layerScore: row.score * 1000, // Scale to match other scores
      }));

  } catch (error) {
    console.error('[Search] Layer 2 error:', error);
    return [];
  }
}

/**
 * Layer 3: Fuzzy Search using pg_trgm
 * Handles typos and similar spellings
 */
async function searchFuzzy(
  query: string,
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  if (dbType !== 'postgres' || !query) return [];

  const pool = getPostgresPool();

  try {
    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        GREATEST(
          similarity(j.title, $1),
          similarity(j.company, $1),
          similarity(j.location, $1)
        ) as sim_score
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        (j.title % $1 OR j.company % $1 OR j.location % $1)
        ${buildFilterClauses(filters, 2)}
      ORDER BY sim_score DESC
      LIMIT $${getNextParamIndex(filters, 2)}
    `;

    const values = [
      query,
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.FUZZY,
    ];

    const result = await pool.query(sql, values);

    return result.rows
      .filter(row => row.sim_score >= SEARCH_CONFIG.THRESHOLDS.FUZZY_MIN_SIMILARITY)
      .map(row => ({
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        title_normalized: row.title_normalized,
        company_normalized: row.company_normalized,
        location_normalized: row.location_normalized,
        job_description_plain: row.job_description_plain,
        posted_at: row.posted_at,
        fetched_at: row.fetched_at,
        source_url: row.source_url,
        content_hash: row.content_hash,
        embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
        layer: 'fuzzy',
        layerScore: row.sim_score * 800, // Scale similarity to score range
      }));

  } catch (error) {
    console.error('[Search] Layer 3 error:', error);
    return [];
  }
}

/**
 * Layer 4: Semantic Search using pgvector
 * Finds jobs with similar meaning even if keywords differ
 */
async function searchSemantic(
  query: string,
  queryEmbedding: number[] | null,
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  if (dbType !== 'postgres' || !queryEmbedding) return [];

  const pool = getPostgresPool();

  try {
    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        1 - (je.embedding <=> $1::vector) as similarity
      FROM jobs j
      JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        1 - (je.embedding <=> $1::vector) >= $2
        ${buildFilterClauses(filters, 3)}
      ORDER BY je.embedding <=> $1::vector
      LIMIT $${getNextParamIndex(filters, 3)}
    `;

    const values = [
      `[${queryEmbedding.join(',')}]`,
      SEARCH_CONFIG.THRESHOLDS.SEMANTIC_MIN_SIMILARITY,
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.SEMANTIC,
    ];

    const result = await pool.query(sql, values);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      title_normalized: row.title_normalized,
      company_normalized: row.company_normalized,
      location_normalized: row.location_normalized,
      job_description_plain: row.job_description_plain,
      posted_at: row.posted_at,
      fetched_at: row.fetched_at,
      source_url: row.source_url,
      content_hash: row.content_hash,
      embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
      layer: 'semantic',
      layerScore: row.similarity * 700, // Scale similarity to score range
    }));

  } catch (error) {
    console.error('[Search] Layer 4 error:', error);
    return [];
  }
}

/**
 * Layer 5: Broad Token Match
 * Finds jobs matching ANY of the query tokens
 */
async function searchBroadMatch(
  tokens: string[],
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  if (dbType !== 'postgres' || tokens.length === 0) return [];

  const pool = getPostgresPool();

  try {
    // Create OR patterns for each token
    const patterns = tokens.map(t => `%${t}%`);

    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        (
          CASE WHEN ${tokens.map((_, i) => `j.title_normalized ILIKE $${i + 1}`).join(' OR ')} THEN 1 ELSE 0 END +
          CASE WHEN ${tokens.map((_, i) => `j.company_normalized ILIKE $${i + 1}`).join(' OR ')} THEN 1 ELSE 0 END +
          CASE WHEN ${tokens.map((_, i) => `j.location_normalized ILIKE $${i + 1}`).join(' OR ')} THEN 1 ELSE 0 END
        ) as match_count
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        (${tokens.map((_, i) => `j.title_normalized ILIKE $${i + 1}`).join(' OR ')})
        OR (${tokens.map((_, i) => `j.company_normalized ILIKE $${i + 1}`).join(' OR ')})
        OR (${tokens.map((_, i) => `j.location_normalized ILIKE $${i + 1}`).join(' OR ')})
        ${buildFilterClauses(filters, tokens.length + 1)}
      ORDER BY match_count DESC, j.posted_at DESC NULLS LAST
      LIMIT $${getNextParamIndex(filters, tokens.length + 1)}
    `;

    const values = [
      ...patterns,
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.BROAD,
    ];

    const result = await pool.query(sql, values);

    return result.rows
      .filter(row => row.match_count >= SEARCH_CONFIG.THRESHOLDS.BROAD_MIN_TOKENS)
      .map(row => ({
        id: row.id,
        title: row.title,
        company: row.company,
        location: row.location,
        title_normalized: row.title_normalized,
        company_normalized: row.company_normalized,
        location_normalized: row.location_normalized,
        job_description_plain: row.job_description_plain,
        posted_at: row.posted_at,
        fetched_at: row.fetched_at,
        source_url: row.source_url,
        content_hash: row.content_hash,
        embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
        layer: 'broad',
        layerScore: row.match_count * 200, // Score based on token matches
      }));

  } catch (error) {
    console.error('[Search] Layer 5 error:', error);
    return [];
  }
}

/**
 * Layer 6: Default Results
 * Most recent jobs - ensures we always have something to show
 */
async function searchDefaultResults(
  filters: SearchFilters,
  userId?: string
): Promise<RawCandidate[]> {
  const dbType = getDbType();
  if (dbType !== 'postgres') return [];

  const pool = getPostgresPool();

  try {
    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        je.embedding as job_embedding,
        100 as score
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 1=1
        ${buildFilterClauses(filters, 1)}
      ORDER BY j.posted_at DESC NULLS LAST
      LIMIT $${getNextParamIndex(filters, 1)}
    `;

    const values = [
      ...getFilterValues(filters),
      SEARCH_CONFIG.LAYER_LIMITS.DEFAULT,
    ];

    const result = await pool.query(sql, values);

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      title_normalized: row.title_normalized,
      company_normalized: row.company_normalized,
      location_normalized: row.location_normalized,
      job_description_plain: row.job_description_plain,
      posted_at: row.posted_at,
      fetched_at: row.fetched_at,
      source_url: row.source_url,
      content_hash: row.content_hash,
      embedding: row.job_embedding ? JSON.parse(row.job_embedding) : null,
      layer: 'default',
      layerScore: row.score,
    }));

  } catch (error) {
    console.error('[Search] Layer 6 error:', error);
    return [];
  }
}

/**
 * Emergency Results
 * Absolute last resort - returns any jobs from the database
 */
async function getEmergencyResults(
  filters: SearchFilters,
  userId?: string
): Promise<SearchResultJob[]> {
  const dbType = getDbType();
  console.log('[Enhanced Search] Emergency - dbType:', dbType);

  if (dbType !== 'postgres') {
    console.log('[Enhanced Search] Emergency - Not postgres, returning empty');
    return [];
  }

  const pool = getPostgresPool();

  try {
    const sql = `
      SELECT 
        j.id, j.title, j.company, j.location,
        j.title_normalized, j.company_normalized, j.location_normalized,
        j.job_description_plain, j.posted_at, j.fetched_at, j.source_url, j.content_hash,
        j.status, j.match_score, j.matched_skills, j.missing_skills, j.why,
        je.embedding as job_embedding
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      ORDER BY j.posted_at DESC NULLS LAST
      LIMIT 20
    `;

    console.log('[Enhanced Search] Emergency - Executing query...');
    const result = await pool.query(sql);
    console.log('[Enhanced Search] Emergency - Query returned', result.rows.length, 'rows');

    return result.rows.map(row => ({
      id: row.id,
      title: row.title,
      company: row.company,
      location: row.location,
      source_url: row.source_url,
      posted_at: row.posted_at?.toISOString?.() || null,
      fetched_at: row.fetched_at?.toISOString?.() || new Date().toISOString(),
      status: row.status || 'fresh',
      match_score: row.match_score || 0,
      matched_skills: row.matched_skills || null,
      missing_skills: row.missing_skills || null,
      why: row.why || null,
      normalized_text: row.job_description_plain || null,
      raw_text_summary: row.raw_text_summary || null,
      content_hash: row.content_hash,
      relevanceScore: 50, // Low but valid score
      matchCategories: ['default'] as MatchCategory[],
      matchSnippet: 'Related job',
      whyMatched: {}, // Empty match details for default results
    }));

  } catch (error) {
    console.error('[Search] Emergency results error:', error);
    return [];
  }
}

// ============================================================================
// Enhanced Scoring and Ranking
// ============================================================================

async function scoreAndRankCandidatesEnhanced(
  candidates: RawCandidate[],
  query: string,
  tokens: string[],
  queryType: QueryType,
  queryEmbedding: number[] | null
): Promise<SearchResultJob[]> {
  const weights = getWeightsForQueryType(queryType);

  const scored = candidates.map(candidate => {
    // Calculate semantic similarity if we have embeddings
    let semanticSimilarity = 0;
    if (candidate.embedding && queryEmbedding) {
      semanticSimilarity = cosineSimilarity(candidate.embedding, queryEmbedding);
    }

    // Calculate text-based scores
    const titleScore = calculateTitleScore(candidate.title || '', query, tokens);
    const companyScore = calculateCompanyScore(candidate.company, query, tokens);
    const locationScore = calculateLocationScore(candidate.location, query, tokens);

    // Layer bonus - exact matches get priority
    const layerBonus = getLayerBonus(candidate.layer);

    // Combine scores using hybrid approach
    const textScore = (titleScore * weights.title) +
      (companyScore * weights.company) +
      (locationScore * weights.location);

    const semanticScore = semanticSimilarity * weights.semantic * 1000;

    // Final hybrid score
    const hybridScore =
      (textScore * SEARCH_CONFIG.HYBRID_WEIGHTS.TEXT_RELEVANCE) +
      (semanticScore * SEARCH_CONFIG.HYBRID_WEIGHTS.SEMANTIC_SIMILARITY) +
      layerBonus;

    // Detect match categories for UI
    const categories = detectMatchCategoriesEnhanced(
      candidate,
      query,
      tokens,
      semanticSimilarity,
      titleScore,
      companyScore,
      locationScore
    );

    // Generate match explanation
    const whyMatched = {
      titleMatch: titleScore > 0,
      companyMatch: companyScore > 0,
      locationMatch: locationScore > 0,
      semanticMatch: semanticSimilarity > 0 ? Math.round(semanticSimilarity * 100) / 100 : undefined,
      layer: candidate.layer,
    };

    // Generate snippet
    const matchSnippet = generateMatchSnippetEnhanced(candidate, query, tokens, categories);

    return {
      id: candidate.id,
      title: candidate.title,
      company: candidate.company,
      location: candidate.location,
      source_url: candidate.source_url,
      posted_at: candidate.posted_at?.toISOString?.() || null,
      fetched_at: candidate.fetched_at?.toISOString?.() || new Date().toISOString(),
      status: (candidate as any).status || 'fresh',
      match_score: (candidate as any).match_score || 0,
      matched_skills: (candidate as any).matched_skills || null,
      missing_skills: (candidate as any).missing_skills || null,
      why: (candidate as any).why || null,
      normalized_text: candidate.job_description_plain || null,
      raw_text_summary: (candidate as any).raw_text_summary || null,
      content_hash: candidate.content_hash,
      relevanceScore: Math.round(hybridScore),
      matchCategories: categories,
      matchSnippet,
      whyMatched,
    };
  });

  // Sort by relevance score descending
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return scored;
}

function getLayerBonus(layer: string): number {
  // Give priority to higher-quality match layers
  const bonuses: Record<string, number> = {
    'exact': 500,
    'fts': 300,
    'fuzzy': 200,
    'semantic': 150,
    'broad': 100,
    'default': 0,
  };
  return bonuses[layer] || 0;
}

function detectMatchCategoriesEnhanced(
  candidate: RawCandidate,
  query: string,
  tokens: string[],
  semanticSimilarity: number,
  titleScore: number,
  companyScore: number,
  locationScore: number
): MatchCategory[] {
  const categories: MatchCategory[] = [];

  // Priority order for ranking display
  if (titleScore >= 600) {
    categories.push('title');
  }

  if (companyScore >= 400) {
    categories.push('company');
  }

  if (locationScore >= 300) {
    categories.push('location');
  }

  if (semanticSimilarity > 0.5) {
    categories.push('semantic');
  }

  if (categories.length === 0) {
    categories.push('fuzzy');
  }

  return categories;
}

function generateMatchSnippetEnhanced(
  candidate: RawCandidate,
  query: string,
  tokens: string[],
  categories: MatchCategory[]
): string {
  const parts: string[] = [];

  // Always show title if matched
  if (categories.includes('title')) {
    parts.push(`Title: ${candidate.title}`);
  }

  // Show company if matched
  if (categories.includes('company') && candidate.company) {
    parts.push(`Company: ${candidate.company}`);
  }

  // Show location if matched
  if (categories.includes('location') && candidate.location) {
    parts.push(`Location: ${candidate.location}`);
  }

  // If nothing specific matched, show description preview
  if (parts.length === 0 && candidate.job_description_plain) {
    const preview = candidate.job_description_plain.substring(0, 100).trim();
    return preview + (candidate.job_description_plain.length > 100 ? '...' : '');
  }

  return parts.join(' • ');
}

// ============================================================================
// Helper Functions
// ============================================================================

function buildFilterClauses(filters: SearchFilters, startIndex: number): string {
  const clauses: string[] = [];
  let paramIndex = startIndex;

  if (filters.remoteOnly) {
    clauses.push(`AND (j.location_normalized ILIKE '%remote%' OR j.location_normalized ILIKE '%work from home%')`);
  }

  if (filters.location) {
    clauses.push(`AND j.location_normalized ILIKE $${paramIndex}`);
    paramIndex++;
  }

  if (filters.datePosted && filters.datePosted !== 'all') {
    clauses.push(`AND j.posted_at > CASE 
      WHEN $${paramIndex} = '24h' THEN NOW() - INTERVAL '24 hours'
      WHEN $${paramIndex} = '7d' THEN NOW() - INTERVAL '7 days'
      WHEN $${paramIndex} = '30d' THEN NOW() - INTERVAL '30 days'
      ELSE '1970-01-01'::timestamp
    END`);
    paramIndex++;
  }

  return clauses.join(' ');
}

function getFilterValues(filters: SearchFilters): (string | boolean)[] {
  const values: (string | boolean)[] = [];

  if (filters.location) {
    values.push(`%${normalizeText(filters.location)}%`);
  }

  if (filters.datePosted && filters.datePosted !== 'all') {
    values.push(filters.datePosted);
  }

  return values;
}

function getNextParamIndex(filters: SearchFilters, startIndex: number): number {
  let index = startIndex;

  if (filters.location) index++;
  if (filters.datePosted && filters.datePosted !== 'all') index++;

  return index;
}

// Re-export utility functions
export {
  suggestCorrection,
  generateAlternatives,
  classifyQuery,
  normalizeText,
  tokenize
};

// Import needed scoring functions
function calculateTitleScore(jobTitle: string, query: string, queryTokens: string[]): number {
  if (!jobTitle || !query) return 0;

  const title = normalizeText(jobTitle);
  const normalizedQuery = normalizeText(query);
  let score = 0;

  if (title === normalizedQuery) {
    return 1000;
  }

  if (title.startsWith(normalizedQuery)) {
    score = Math.max(score, 800);
  }

  if (title.includes(normalizedQuery)) {
    score = Math.max(score, 600);
  }

  const matchingTokens = queryTokens.filter(token => title.includes(token)).length;

  if (queryTokens.length > 0 && matchingTokens === queryTokens.length) {
    score = Math.max(score, 400);
  }

  score += matchingTokens * 50;

  return score;
}

function calculateCompanyScore(company: string | null, query: string, queryTokens: string[]): number {
  if (!company || !query) return 0;

  const companyNorm = normalizeText(company);
  const normalizedQuery = normalizeText(query);
  let score = 0;

  if (companyNorm === normalizedQuery) {
    return 600;
  }

  if (companyNorm.includes(normalizedQuery)) {
    score = Math.max(score, 400);
  }

  score += queryTokens.filter(token => companyNorm.includes(token)).length * 30;

  return score;
}

function calculateLocationScore(location: string | null, query: string, queryTokens: string[]): number {
  if (!location || !query) return 0;

  const locationNorm = normalizeText(location);
  const normalizedQuery = normalizeText(query);
  let score = 0;

  if (locationNorm === normalizedQuery) {
    return 450;
  }

  if (locationNorm.includes(normalizedQuery)) {
    score = Math.max(score, 300);
  }

  const remoteKeywords = ['remote', 'work from home', 'wfh', 'virtual'];
  const hasRemoteKeyword = remoteKeywords.some(kw => normalizedQuery.includes(kw));
  const isRemoteJob = remoteKeywords.some(kw => locationNorm.includes(kw));

  if (hasRemoteKeyword && isRemoteJob) {
    score = Math.max(score, 350);
  }

  score += queryTokens.filter(token => locationNorm.includes(token)).length * 25;

  return score;
}
