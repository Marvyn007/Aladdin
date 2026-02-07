/**
 * Search Module Public API
 * 
 * This module provides a comprehensive, two-stage job search system:
 * 
 * Stage 1: Hard Match Filtering (PostgreSQL Full-Text + ILIKE)
 *   - Exact and partial matches on title, company, location
 *   - Full-text search with weighted fields
 *   - Fast candidate selection (top 500)
 * 
 * Stage 2: Semantic Scoring (pgvector + Cosine Similarity)
 *   - Query embedding using Xenova/all-MiniLM-L6-v2
 *   - Cosine similarity with pre-computed job embeddings
 *   - Combined weighted scoring for final ranking
 * 
 * Features:
 *   - Fuzzy matching fallback (Levenshtein + Trigram)
 *   - Query classification and intent detection
 *   - Autocomplete suggestions
 *   - "Did you mean" spelling corrections
 *   - Alternative query suggestions
 * 
 * Usage:
 *   import { searchJobs } from '@/lib/search';
 *   
 *   const results = await searchJobs({
 *     query: 'software engineer',
 *     page: 1,
 *     limit: 50,
 *     filters: { remoteOnly: true }
 *   });
 */

// Main search function
export { searchJobs, classifyQuery, suggestCorrection, generateAlternatives } from './search';

// Enhanced search with guaranteed results
export { searchJobsEnhanced } from './enhanced';
export type { SearchResponse as EnhancedSearchResponse } from './types';

// Type definitions
export type {
  SearchQuery,
  SearchResponse,
  SearchResultJob,
  SearchFilters,
  SearchPagination,
  MatchCategory,
  QueryType,
  QueryClassification,
  MatchScore,
  ScoringWeights,
  SuggestionResponse,
  TokenizedQuery,
} from './types';

// Tokenization utilities
export {
  normalizeText,
  tokenize,
  extractPhrases,
  classifyQuery as classifyQueryFromTokenizer,
  createTokenizedQuery,
  containsAllTokens,
  containsAnyToken,
  countMatchingTokens,
  isLikelyCompanyName,
  isLikelyLocation,
} from './tokenizer';

// Scoring functions
export {
  calculateTitleScore,
  calculateCompanyScore,
  calculateLocationScore,
  calculateSemanticScore,
  calculateTotalScore,
  getWeightsForQueryType,
  scoreJobResult,
  detectMatchCategories,
  generateMatchDetails,
  generateMatchSnippet,
  isRelevantScore,
  SCORE_THRESHOLDS,
} from './scoring';

// Semantic search utilities
export {
  getQueryEmbedding,
  clearEmbeddingCache,
  getCacheStats,
  cosineSimilarity,
  normalizeSimilarity,
  distanceToSimilarity,
  expandQueryForSemantic,
  generateRichEmbedding,
  isSimilarityRelevant,
  SIMILARITY_THRESHOLDS,
} from './semantic';

// Fuzzy matching utilities
export {
  levenshteinDistance,
  levenshteinSimilarity,
  isFuzzyMatch,
  generateTrigrams,
  trigramSimilarity,
  meetsFuzzyThreshold,
  suggestCorrection as suggestCorrectionFromFuzzy,
  generateAlternatives as generateAlternativesFromFuzzy,
  fuzzyMatchFallback,
  FUZZY_THRESHOLDS,
} from './fuzzy';

// Constants
export { DEFAULT_WEIGHTS, QUERY_TYPE_WEIGHTS } from './types';
