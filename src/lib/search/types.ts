/**
 * Search Types and Interfaces
 * Defines the data structures for the two-stage search pipeline
 */

import type { Job } from '@/types';

// ============================================================================
// Core Search Types
// ============================================================================

export interface SearchFilters {
  location?: string;
  remoteOnly?: boolean;
  datePosted?: '24h' | '7d' | '30d' | 'all';
  company?: string;
  title?: string;
}

export interface SearchPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SearchTiming {
  stage1_ms: number;
  stage2_ms: number;
  total_ms: number;
}

export interface MatchDetails {
  titleMatch?: boolean;
  companyMatch?: boolean;
  locationMatch?: boolean;
  semanticMatch?: number;  // 0-1 similarity score
}

export interface SearchResultJob extends Job {
  relevanceScore: number;
  matchCategories: MatchCategory[];
  matchSnippet?: string;
  whyMatched: MatchDetails;
}

export type MatchCategory = 'title' | 'company' | 'location' | 'semantic' | 'fuzzy' | 'default';

export interface SearchResponse {
  jobs: SearchResultJob[];
  pagination: SearchPagination;
  query: {
    original: string;
    normalized: string;
    embedding: number[];
    queryType: QueryType;
  };
  timing: SearchTiming;
  didYouMean?: string;  // Suggested correction if fuzzy match used
  fallbackUsed?: boolean;  // True if fuzzy/semantic fallback was applied
  layersUsed?: string[];  // Which search layers were used
  totalCandidates?: number;  // Total candidates found before ranking
}

export interface SearchQuery {
  query: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
  userId?: string;
}

// ============================================================================
// Query Classification
// ============================================================================

export type QueryType = 
  | 'title_only'      // e.g., "software engineer"
  | 'company_only'    // e.g., "Google"
  | 'location_only'   // e.g., "New York"
  | 'title_company'   // e.g., "engineer at Stripe"
  | 'title_location'  // e.g., "developer in Austin"
  | 'company_location'// e.g., "Google in NYC"
  | 'compound';       // e.g., "senior backend engineer remote"

export interface QueryClassification {
  type: QueryType;
  confidence: number;
  tokens: {
    title?: string[];
    company?: string[];
    location?: string[];
    other?: string[];
  };
}

// ============================================================================
// Scoring Types
// ============================================================================

export interface MatchScore {
  title: number;
  company: number;
  location: number;
  semantic: number;
  fuzzy: number;
  total: number;
}

export interface ScoringWeights {
  title: number;
  company: number;
  location: number;
  semantic: number;
}

export const DEFAULT_WEIGHTS: ScoringWeights = {
  title: 3.0,
  company: 2.0,
  location: 1.5,
  semantic: 1.0,
};

// Weights adjusted by query type for better relevance
export const QUERY_TYPE_WEIGHTS: Record<QueryType, Partial<ScoringWeights>> = {
  title_only: { title: 4.0, company: 1.5, location: 1.0, semantic: 1.2 },
  company_only: { title: 1.5, company: 4.0, location: 1.0, semantic: 0.8 },
  location_only: { title: 1.5, company: 1.0, location: 4.0, semantic: 0.8 },
  title_company: { title: 3.5, company: 3.5, location: 0.8, semantic: 1.0 },
  title_location: { title: 3.5, company: 1.0, location: 3.5, semantic: 1.0 },
  company_location: { title: 1.0, company: 3.5, location: 3.5, semantic: 0.8 },
  compound: { title: 3.0, company: 2.0, location: 1.5, semantic: 1.0 },
};

// ============================================================================
// Suggestion Types
// ============================================================================

export interface SuggestionResponse {
  suggestions: {
    titles: string[];
    companies: string[];
    locations: string[];
  };
  query: string;
  total: number;
}

export interface SuggestionOptions {
  type?: 'all' | 'title' | 'company' | 'location';
  limit?: number;
}

// ============================================================================
// Smart Suggestion Types (Enhanced with ranking and autofill)
// ============================================================================

export interface SmartSuggestion {
  text: string;
  type: 'title' | 'company' | 'location';
  rank: number;
  isPopular: boolean;
  isExactMatch: boolean;
  matchCount: number;
  highlightStart: number;
  highlightEnd: number;
}

export interface TrendingSearch {
  text: string;
  type: string;
  count: number;
}

export interface SmartSuggestionResponse {
  suggestions: SmartSuggestion[];
  autofill: string | null;
  autofillType: 'title' | 'company' | 'location' | null;
  trending: TrendingSearch[];
  query: string;
  total: number;
}

// ============================================================================
// Database Types (for internal use)
// ============================================================================

export interface DatabaseJobMatch {
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
  // Vector embedding as array
  embedding: number[] | null;
}

export interface RawSearchResult extends DatabaseJobMatch {
  // Match scores from database
  title_score?: number;
  company_score?: number;
  location_score?: number;
  fts_score?: number;
  similarity?: number;
}

// ============================================================================
// Tokenization Types
// ============================================================================

export interface TokenizedQuery {
  original: string;
  normalized: string;
  tokens: string[];
  phrases: string[];
  categories: {
    role?: string[];
    seniority?: string[];
    technology?: string[];
    company?: string[];
    location?: string[];
  };
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CachedEmbedding {
  query: string;
  embedding: number[];
  timestamp: number;
}

export interface SearchCache {
  key: string;
  results: SearchResponse;
  timestamp: number;
}
