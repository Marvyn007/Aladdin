/**
 * Main Search Orchestrator
 * Coordinates the two-stage search pipeline
 */

import { getDbType } from '@/lib/db';
import { getPostgresPool } from '@/lib/postgres';
import type { 
  SearchQuery, 
  SearchResponse, 
  SearchResultJob, 
  RawSearchResult,
  QueryClassification,
  MatchCategory
} from './types';
import { classifyQuery, createTokenizedQuery, normalizeText } from './tokenizer';
import { 
  scoreJobResult, 
  detectMatchCategories, 
  generateMatchDetails, 
  generateMatchSnippet,
  isRelevantScore,
  SCORE_THRESHOLDS 
} from './scoring';
import { 
  getQueryEmbedding, 
  SIMILARITY_THRESHOLDS,
} from './semantic';
import { 
  suggestCorrection, 
  generateAlternatives,
} from './fuzzy';

// ============================================================================
// Configuration
// ============================================================================

const SEARCH_CONFIG = {
  STAGE1_CANDIDATE_LIMIT: 500,
  MIN_RESULTS_BEFORE_FALLBACK: 5,
  MAX_RESULTS: 100,
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 50,
  SEMANTIC_THRESHOLD: SIMILARITY_THRESHOLDS.MODERATE,
};

// ============================================================================
// Main Search Function
// ============================================================================

export async function searchJobs(params: SearchQuery): Promise<SearchResponse> {
  const startTime = Date.now();
  
  const query = params.query.trim();
  const page = Math.max(1, params.page || SEARCH_CONFIG.DEFAULT_PAGE);
  const limit = Math.min(
    SEARCH_CONFIG.MAX_RESULTS,
    Math.max(1, params.limit || SEARCH_CONFIG.DEFAULT_LIMIT)
  );
  const filters = params.filters || {};
  
  const classification = classifyQuery(query);
  const tokenized = createTokenizedQuery(query);
  
  // Stage 1: Hard match filtering
  const stage1Start = Date.now();
  let candidates = await stage1HardMatch(query, tokenized.tokens, filters, params.userId);
  const stage1Duration = Date.now() - stage1Start;
  
  // Stage 2: Semantic scoring
  const stage2Start = Date.now();
  let results: SearchResultJob[] = [];
  let fallbackUsed = false;
  let didYouMean: string | undefined;
  
  if (candidates.length === 0) {
    fallbackUsed = true;
    const fuzzyResult = await fuzzyFallbackSearch(query, filters, params.userId);
    candidates = fuzzyResult.candidates;
    didYouMean = fuzzyResult.suggestion;
  }
  
  if (candidates.length > 0) {
    const queryEmbedding = await getQueryEmbedding(query);
    
    results = await scoreAndRankCandidates(
      candidates,
      query,
      tokenized.tokens,
      classification,
      queryEmbedding
    );
    
    const total = results.length;
    const offset = (page - 1) * limit;
    results = results.slice(offset, offset + limit);
    
    if (results.length < SEARCH_CONFIG.MIN_RESULTS_BEFORE_FALLBACK && !fallbackUsed) {
      const semanticResults = await semanticFallbackSearch(
        query, 
        queryEmbedding,
        filters,
        params.userId,
        SEARCH_CONFIG.MIN_RESULTS_BEFORE_FALLBACK - results.length
      );
      
      results = mergeResults(results, semanticResults);
    }
  }
  
  const stage2Duration = Date.now() - stage2Start;
  const totalDuration = Date.now() - startTime;
  
  return {
    jobs: results,
    pagination: {
      page,
      limit,
      total: results.length,
      totalPages: Math.ceil(results.length / limit),
    },
    query: {
      original: params.query,
      normalized: tokenized.normalized,
      embedding: await getQueryEmbedding(query),
      queryType: classification.type,
    },
    timing: {
      stage1_ms: stage1Duration,
      stage2_ms: stage2Duration,
      total_ms: totalDuration,
    },
    didYouMean,
    fallbackUsed,
  };
}

// ============================================================================
// Stage 1: Hard Match Filtering
// ============================================================================

async function stage1HardMatch(
  query: string,
  tokens: string[],
  filters: SearchQuery['filters'],
  userId?: string
): Promise<RawSearchResult[]> {
  const dbType = getDbType();
  
  if (dbType !== 'postgres') {
    console.warn('[Search] Vector search only supported on PostgreSQL');
    return [];
  }
  
  const normalizedQuery = normalizeText(query);
  const pool = getPostgresPool();
  
  try {
    const sql = `
      WITH hard_matches AS (
        SELECT 
          j.*,
          CASE 
            WHEN j.title_normalized = $1 THEN 1000
            WHEN j.title_normalized LIKE $2 THEN 800
            WHEN j.title_normalized LIKE $3 THEN 600
            WHEN j.search_title_tokens @@ plainto_tsquery('simple', $4) THEN 400
            ELSE 0
          END as title_score,
          CASE 
            WHEN j.company_normalized = $1 THEN 600
            WHEN j.company_normalized LIKE $2 THEN 400
            WHEN j.search_company_tokens @@ plainto_tsquery('simple', $4) THEN 300
            ELSE 0
          END as company_score,
          CASE 
            WHEN j.location_normalized = $1 THEN 450
            WHEN j.location_normalized LIKE $2 THEN 300
            WHEN j.location_normalized LIKE '%' || $4 || '%' THEN 200
            ELSE 0
          END as location_score,
          ts_rank_cd(j.search_content, plainto_tsquery('simple', $4), 32) as fts_score,
          je.embedding as job_embedding
        FROM jobs j
        LEFT JOIN job_embeddings je ON j.id = je.job_id
        WHERE 
          (
            j.title_normalized ILIKE $3
            OR j.company_normalized ILIKE $3
            OR j.location_normalized ILIKE $3
            OR j.search_content @@ plainto_tsquery('simple', $4)
          )
          ${filters?.remoteOnly ? "AND (j.location_normalized ILIKE '%remote%' OR j.location_normalized ILIKE '%work from home%')" : ''}
          ${filters?.location ? "AND j.location_normalized ILIKE '%' || $5 || '%'" : ''}
          ${filters?.datePosted && filters.datePosted !== 'all' ? `
            AND j.posted_at > CASE 
              WHEN $6 = '24h' THEN NOW() - INTERVAL '24 hours'
              WHEN $6 = '7d' THEN NOW() - INTERVAL '7 days'
              WHEN $6 = '30d' THEN NOW() - INTERVAL '30 days'
              ELSE '1970-01-01'::timestamp
            END
          ` : ''}
        ORDER BY 
          (CASE 
            WHEN j.title_normalized = $1 THEN 1000
            WHEN j.title_normalized LIKE $2 THEN 800
            WHEN j.company_normalized = $1 THEN 600
            ELSE 0
          END) DESC,
          ts_rank_cd(j.search_content, plainto_tsquery('simple', $4), 32) DESC
        LIMIT $7
      )
      SELECT * FROM hard_matches
    `;
    
    const values = [
      normalizedQuery,
      `${normalizedQuery}%`,
      `%${normalizedQuery}%`,
      query,
      filters?.location ? normalizeText(filters.location) : '',
      filters?.datePosted || 'all',
      SEARCH_CONFIG.STAGE1_CANDIDATE_LIMIT,
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
      title_score: row.title_score,
      company_score: row.company_score,
      location_score: row.location_score,
      fts_score: row.fts_score,
    }));
    
  } catch (error) {
    console.error('[Search] Stage 1 error:', error);
    return [];
  }
}

// ============================================================================
// Stage 2: Scoring and Ranking
// ============================================================================

async function scoreAndRankCandidates(
  candidates: RawSearchResult[],
  query: string,
  tokens: string[],
  classification: QueryClassification,
  queryEmbedding: number[]
): Promise<SearchResultJob[]> {
  const scored = candidates.map(candidate => {
    let semanticSimilarity: number | undefined;
    if (candidate.embedding && queryEmbedding) {
      const dotProduct = candidate.embedding.reduce((sum, val, i) => 
        sum + val * queryEmbedding[i], 0
      );
      const norm1 = Math.sqrt(candidate.embedding.reduce((sum, val) => sum + val * val, 0));
      const norm2 = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val * val, 0));
      semanticSimilarity = dotProduct / (norm1 * norm2);
    }
    
    const scores = scoreJobResult(candidate, query, tokens, classification.type, semanticSimilarity);
    const categories = detectMatchCategories(candidate, query, tokens, semanticSimilarity);
    const whyMatched = generateMatchDetails(candidate, query, tokens, semanticSimilarity);
    const matchSnippet = generateMatchSnippet(candidate, query, tokens);
    
    const resultJob: SearchResultJob = {
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
      relevanceScore: scores.total,
      matchCategories: categories,
      matchSnippet,
      whyMatched,
    };
    
    return resultJob;
  });
  
  const filtered = scored.filter(job => isRelevantScore(job.relevanceScore));
  filtered.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return filtered;
}

// ============================================================================
// Fallback Searches
// ============================================================================

async function fuzzyFallbackSearch(
  query: string,
  filters: SearchQuery['filters'],
  userId?: string
): Promise<{ candidates: RawSearchResult[]; suggestion?: string }> {
  const dbType = getDbType();
  
  if (dbType !== 'postgres') {
    return { candidates: [] };
  }
  
  const suggestion = suggestCorrection(query);
  const pool = getPostgresPool();
  
  try {
    const sql = `
      SELECT 
        j.*,
        je.embedding as job_embedding,
        GREATEST(
          similarity(j.title, $1),
          similarity(j.company, $1),
          similarity(j.location, $1)
        ) as fuzzy_score
      FROM jobs j
      LEFT JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        j.title % $1
        OR j.company % $1
        OR j.location % $1
        ${filters?.remoteOnly ? "AND (j.location_normalized ILIKE '%remote%' OR j.location_normalized ILIKE '%work from home%')" : ''}
        ${filters?.location ? "AND j.location_normalized ILIKE '%' || $2 || '%'" : ''}
      ORDER BY 
        GREATEST(
          similarity(j.title, $1),
          similarity(j.company, $1),
          similarity(j.location, $1)
        ) DESC
      LIMIT $3
    `;
    
    const values = [
      query,
      filters?.location ? normalizeText(filters.location) : '',
      SEARCH_CONFIG.STAGE1_CANDIDATE_LIMIT,
    ];
    
    const result = await pool.query(sql, values);
    
    const candidates = result.rows.map(row => ({
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
      title_score: row.fuzzy_score * 200,
    }));
    
    return { candidates, suggestion };
    
  } catch (error) {
    console.error('[Search] Fuzzy fallback error:', error);
    return { candidates: [] };
  }
}

async function semanticFallbackSearch(
  query: string,
  queryEmbedding: number[],
  filters: SearchQuery['filters'],
  userId?: string,
  limit: number = 10
): Promise<SearchResultJob[]> {
  const dbType = getDbType();
  
  if (dbType !== 'postgres') {
    return [];
  }
  
  const pool = getPostgresPool();
  
  try {
    const sql = `
      SELECT 
        j.*,
        je.embedding as job_embedding,
        1 - (je.embedding <=> $1::vector) as similarity
      FROM jobs j
      JOIN job_embeddings je ON j.id = je.job_id
      WHERE 
        1 - (je.embedding <=> $1::vector) >= $2
        ${filters?.remoteOnly ? "AND (j.location_normalized ILIKE '%remote%' OR j.location_normalized ILIKE '%work from home%')" : ''}
        ${filters?.location ? "AND j.location_normalized ILIKE '%' || $3 || '%'" : ''}
      ORDER BY je.embedding <=> $1::vector
      LIMIT $4
    `;
    
    const values = [
      `[${queryEmbedding.join(',')}]`,
      SIMILARITY_THRESHOLDS.MODERATE,
      filters?.location ? normalizeText(filters.location) : '',
      limit,
    ];
    
    const result = await pool.query(sql, values);
    
    return result.rows.map((row): SearchResultJob => ({
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
      relevanceScore: Math.round(row.similarity * 1000),
      matchCategories: ['semantic'] as MatchCategory[],
      whyMatched: { semanticMatch: row.similarity },
      matchSnippet: undefined,
    }));
    
  } catch (error) {
    console.error('[Search] Semantic fallback error:', error);
    return [];
  }
}

// ============================================================================
// Result Merging
// ============================================================================

function mergeResults(
  primary: SearchResultJob[],
  fallback: SearchResultJob[]
): SearchResultJob[] {
  const seen = new Set(primary.map(j => j.id));
  const merged = [...primary];
  
  for (const job of fallback) {
    if (!seen.has(job.id)) {
      merged.push(job);
      seen.add(job.id);
    }
  }
  
  merged.sort((a, b) => b.relevanceScore - a.relevanceScore);
  
  return merged;
}

// Re-export utilities for convenience
export { classifyQuery, suggestCorrection, generateAlternatives };
