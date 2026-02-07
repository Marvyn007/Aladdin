/**
 * Search Scoring Engine
 * Calculates relevance scores for job matches
 */

import type { 
  MatchScore, 
  ScoringWeights,
  QueryType,
  RawSearchResult 
} from './types';
import { DEFAULT_WEIGHTS, QUERY_TYPE_WEIGHTS } from './types';
import { normalizeText, countMatchingTokens, createTokenizedQuery } from './tokenizer';

// ============================================================================
// Scoring Constants
// ============================================================================

// Base score points for different match types
const SCORES = {
  // Title matches (highest priority)
  TITLE_EXACT: 1000,
  TITLE_STARTS_WITH: 800,
  TITLE_CONTAINS_PHRASE: 600,
  TITLE_ALL_WORDS: 400,
  TITLE_ANY_WORD: 100,
  
  // Company matches
  COMPANY_EXACT: 600,
  COMPANY_CONTAINS: 400,
  COMPANY_WORD_MATCH: 50,
  
  // Location matches
  LOCATION_EXACT: 450,
  LOCATION_CONTAINS: 300,
  LOCATION_REMOTE_MATCH: 350,
  LOCATION_PARTIAL: 150,
  
  // Fuzzy matches
  FUZZY_HIGH: 200,
  FUZZY_MEDIUM: 100,
  FUZZY_LOW: 50,
  
  // Semantic similarity (scaled 0-1)
  SEMANTIC_MULTIPLIER: 1000,
  
  // Bonuses
  MATCH_ALL_TERMS_BONUS: 200,
  RECENCY_BONUS_MAX: 100,
};

// ============================================================================
// Core Scoring Functions
// ============================================================================

/**
 * Calculates title match score
 */
export function calculateTitleScore(
  jobTitle: string,
  query: string,
  queryTokens: string[]
): number {
  if (!jobTitle || !query) return 0;
  
  const title = normalizeText(jobTitle);
  const normalizedQuery = normalizeText(query);
  let score = 0;
  
  // Exact match
  if (title === normalizedQuery) {
    return SCORES.TITLE_EXACT;
  }
  
  // Starts with query
  if (title.startsWith(normalizedQuery)) {
    score = Math.max(score, SCORES.TITLE_STARTS_WITH);
  }
  
  // Contains phrase
  if (title.includes(normalizedQuery)) {
    score = Math.max(score, SCORES.TITLE_CONTAINS_PHRASE);
  }
  
  // Word-level matching
  const matchingTokens = countMatchingTokens(jobTitle, queryTokens);
  
  // All words match
  if (queryTokens.length > 0 && matchingTokens === queryTokens.length) {
    score = Math.max(score, SCORES.TITLE_ALL_WORDS);
  }
  
  // Any word matches
  score += matchingTokens * SCORES.TITLE_ANY_WORD;
  
  return score;
}

/**
 * Calculates company match score
 */
export function calculateCompanyScore(
  company: string | null,
  query: string,
  queryTokens: string[]
): number {
  if (!company || !query) return 0;
  
  const companyNorm = normalizeText(company);
  const normalizedQuery = normalizeText(query);
  let score = 0;
  
  // Exact match
  if (companyNorm === normalizedQuery) {
    return SCORES.COMPANY_EXACT;
  }
  
  // Contains query
  if (companyNorm.includes(normalizedQuery)) {
    score = Math.max(score, SCORES.COMPANY_CONTAINS);
  }
  
  // Word-level matching
  score += countMatchingTokens(company, queryTokens) * SCORES.COMPANY_WORD_MATCH;
  
  return score;
}

/**
 * Calculates location match score
 */
export function calculateLocationScore(
  location: string | null,
  query: string,
  queryTokens: string[]
): number {
  if (!location || !query) return 0;
  
  const locationNorm = normalizeText(location);
  const normalizedQuery = normalizeText(query);
  let score = 0;
  
  // Exact match
  if (locationNorm === normalizedQuery) {
    return SCORES.LOCATION_EXACT;
  }
  
  // Contains query
  if (locationNorm.includes(normalizedQuery)) {
    score = Math.max(score, SCORES.LOCATION_CONTAINS);
  }
  
  // Remote keyword matching
  const remoteKeywords = ['remote', 'work from home', 'wfh', 'virtual'];
  const hasRemoteKeyword = remoteKeywords.some(kw => normalizedQuery.includes(kw));
  const isRemoteJob = remoteKeywords.some(kw => locationNorm.includes(kw));
  
  if (hasRemoteKeyword && isRemoteJob) {
    score = Math.max(score, SCORES.LOCATION_REMOTE_MATCH);
  }
  
  // Word-level matching
  const matchingTokens = countMatchingTokens(location, queryTokens);
  score += matchingTokens * (SCORES.LOCATION_PARTIAL / Math.max(queryTokens.length, 1));
  
  return score;
}

/**
 * Calculates semantic similarity score
 * Expects cosine similarity in range [0, 1]
 */
export function calculateSemanticScore(similarity: number): number {
  // Similarity is already 0-1 from pgvector cosine similarity
  // Higher similarity = closer match
  return similarity * SCORES.SEMANTIC_MULTIPLIER;
}

/**
 * Calculates fuzzy match score using trigram similarity
 */
export function calculateFuzzyScore(
  text: string | null,
  query: string,
  similarity: number  // From pg_trgm (0-1)
): number {
  if (!text || similarity < 0.3) return 0;
  
  if (similarity >= 0.8) {
    return SCORES.FUZZY_HIGH * similarity;
  } else if (similarity >= 0.5) {
    return SCORES.FUZZY_MEDIUM * similarity;
  } else {
    return SCORES.FUZZY_LOW * similarity;
  }
}

// ============================================================================
// Composite Scoring
// ============================================================================

/**
 * Calculates total match score using weighted formula
 */
export function calculateTotalScore(
  scores: Omit<MatchScore, 'total'>,
  weights: ScoringWeights = DEFAULT_WEIGHTS
): number {
  const weighted = 
    (scores.title * weights.title) +
    (scores.company * weights.company) +
    (scores.location * weights.location) +
    (scores.semantic * weights.semantic);
  
  // Add fuzzy as bonus (not weighted)
  const total = weighted + scores.fuzzy;
  
  return Math.round(total);
}

/**
 * Gets appropriate weights based on query type
 */
export function getWeightsForQueryType(queryType: QueryType): ScoringWeights {
  const overrides = QUERY_TYPE_WEIGHTS[queryType];
  return {
    title: overrides.title ?? DEFAULT_WEIGHTS.title,
    company: overrides.company ?? DEFAULT_WEIGHTS.company,
    location: overrides.location ?? DEFAULT_WEIGHTS.location,
    semantic: overrides.semantic ?? DEFAULT_WEIGHTS.semantic,
  };
}

// ============================================================================
// Database Result Scoring
// ============================================================================

/**
 * Scores a raw database result against a query
 */
export function scoreJobResult(
  job: RawSearchResult,
  query: string,
  queryTokens: string[],
  queryType: QueryType,
  semanticSimilarity?: number
): MatchScore {
  const weights = getWeightsForQueryType(queryType);
  
  const titleScore = calculateTitleScore(job.title, query, queryTokens);
  const companyScore = calculateCompanyScore(job.company, query, queryTokens);
  const locationScore = calculateLocationScore(job.location, query, queryTokens);
  
  let semanticScore = 0;
  if (typeof semanticSimilarity === 'number') {
    semanticScore = calculateSemanticScore(semanticSimilarity);
  }
  
  // Check if we have fuzzy scores from database query
  const fuzzyScore = job.title_score || 0;
  
  const scores = {
    title: titleScore,
    company: companyScore,
    location: locationScore,
    semantic: semanticScore,
    fuzzy: fuzzyScore,
  };
  
  return {
    ...scores,
    total: calculateTotalScore(scores, weights),
  };
}

// ============================================================================
// Match Category Detection
// ============================================================================

/**
 * Determines which categories a job matches
 */
export function detectMatchCategories(
  job: RawSearchResult,
  query: string,
  queryTokens: string[],
  semanticSimilarity?: number
): ('title' | 'company' | 'location' | 'semantic' | 'fuzzy')[] {
  const categories: ('title' | 'company' | 'location' | 'semantic' | 'fuzzy')[] = [];
  
  const titleScore = calculateTitleScore(job.title, query, queryTokens);
  const companyScore = calculateCompanyScore(job.company, query, queryTokens);
  const locationScore = calculateLocationScore(job.location, query, queryTokens);
  
  if (titleScore >= SCORES.TITLE_CONTAINS_PHRASE) {
    categories.push('title');
  }
  
  if (companyScore >= SCORES.COMPANY_CONTAINS) {
    categories.push('company');
  }
  
  if (locationScore >= SCORES.LOCATION_CONTAINS) {
    categories.push('location');
  }
  
  if (typeof semanticSimilarity === 'number' && semanticSimilarity > 0.5) {
    categories.push('semantic');
  }
  
  // Fuzzy is a fallback category
  if (categories.length === 0 && (titleScore > 0 || companyScore > 0 || locationScore > 0)) {
    categories.push('fuzzy');
  }
  
  return categories;
}

// ============================================================================
// Match Details
// ============================================================================

/**
 * Generates match details for UI display
 */
export function generateMatchDetails(
  job: RawSearchResult,
  query: string,
  queryTokens: string[],
  semanticSimilarity?: number
): {
  titleMatch?: boolean;
  companyMatch?: boolean;
  locationMatch?: boolean;
  semanticMatch?: number;
} {
  const details: {
    titleMatch?: boolean;
    companyMatch?: boolean;
    locationMatch?: boolean;
    semanticMatch?: number;
  } = {};
  
  const titleScore = calculateTitleScore(job.title, query, queryTokens);
  const companyScore = calculateCompanyScore(job.company, query, queryTokens);
  const locationScore = calculateLocationScore(job.location, query, queryTokens);
  
  if (titleScore >= SCORES.TITLE_CONTAINS_PHRASE) {
    details.titleMatch = true;
  }
  
  if (companyScore >= SCORES.COMPANY_CONTAINS) {
    details.companyMatch = true;
  }
  
  if (locationScore >= SCORES.LOCATION_CONTAINS) {
    details.locationMatch = true;
  }
  
  if (typeof semanticSimilarity === 'number') {
    details.semanticMatch = Math.round(semanticSimilarity * 100) / 100;
  }
  
  return details;
}

// ============================================================================
// Snippet Generation
// ============================================================================

/**
 * Generates a match snippet showing why the job matched
 */
export function generateMatchSnippet(
  job: RawSearchResult,
  query: string,
  queryTokens: string[]
): string | undefined {
  const titleMatch = calculateTitleScore(job.title, query, queryTokens) > 0;
  const companyMatch = calculateCompanyScore(job.company, query, queryTokens) > 0;
  const locationMatch = calculateLocationScore(job.location, query, queryTokens) > 0;
  
  const parts: string[] = [];
  
  if (titleMatch) {
    parts.push(`Title: ${job.title}`);
  }
  
  if (companyMatch && job.company) {
    parts.push(`Company: ${job.company}`);
  }
  
  if (locationMatch && job.location) {
    parts.push(`Location: ${job.location}`);
  }
  
  if (parts.length === 0 && job.job_description_plain) {
    // Return first 100 chars of description
    return job.job_description_plain.substring(0, 100) + '...';
  }
  
  return parts.length > 0 ? parts.join(' • ') : undefined;
}

// ============================================================================
// Thresholds
// ============================================================================

/**
 * Minimum score thresholds for including results
 */
export const SCORE_THRESHOLDS = {
  MINIMUM: 50,        // Absolute minimum to include
  LOW: 100,           // Weak match
  MEDIUM: 300,        // Decent match
  HIGH: 600,          // Strong match
  EXCELLENT: 1000,    // Excellent match
};

/**
 * Determines if a score is good enough to include in results
 */
export function isRelevantScore(score: number, useFallback: boolean = false): boolean {
  if (useFallback) {
    // When using fallback (fuzzy/semantic), be more lenient
    return score >= SCORE_THRESHOLDS.LOW;
  }
  return score >= SCORE_THRESHOLDS.MINIMUM;
}
