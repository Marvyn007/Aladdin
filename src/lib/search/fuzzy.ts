/**
 * Fuzzy Matching Module
 * Provides fallback search using Levenshtein distance and trigram similarity
 */

import { normalizeText, tokenize } from './tokenizer';

// ============================================================================
// Levenshtein Distance
// ============================================================================

/**
 * Calculates Levenshtein distance between two strings
 * This is the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into the other
 */
export function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,  // substitution
          Math.min(
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}

/**
 * Calculates normalized Levenshtein similarity (0-1 range)
 * 1 = identical, 0 = completely different
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;
  if (a === b) return 1;
  
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  
  const distance = levenshteinDistance(a, b);
  return 1 - (distance / maxLength);
}

/**
 * Checks if two strings are fuzzy matches within a threshold
 */
export function isFuzzyMatch(
  a: string,
  b: string,
  maxDistance: number = 2
): boolean {
  const normalizedA = normalizeText(a);
  const normalizedB = normalizeText(b);
  
  // Quick exact match check
  if (normalizedA === normalizedB) return true;
  
  // Length difference check (early exit)
  const lengthDiff = Math.abs(normalizedA.length - normalizedB.length);
  if (lengthDiff > maxDistance) return false;
  
  return levenshteinDistance(normalizedA, normalizedB) <= maxDistance;
}

// ============================================================================
// Trigram Similarity (PostgreSQL pg_trgm style)
// ============================================================================

/**
 * Generates trigrams from a string
 * Trigrams are groups of 3 consecutive characters
 */
export function generateTrigrams(text: string): Set<string> {
  const normalized = normalizeText(text);
  const trigrams = new Set<string>();
  
  // Pad with spaces for boundary trigrams
  const padded = `  ${normalized}  `;
  
  for (let i = 0; i <= padded.length - 3; i++) {
    trigrams.add(padded.substring(i, i + 3));
  }
  
  return trigrams;
}

/**
 * Calculates trigram similarity between two strings
 * Based on PostgreSQL's pg_trgm similarity function
 * Returns value between 0 and 1
 */
export function trigramSimilarity(a: string, b: string): number {
  const trigramsA = generateTrigrams(a);
  const trigramsB = generateTrigrams(b);
  
  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  
  // Count intersection
  let intersection = 0;
  for (const trigram of trigramsA) {
    if (trigramsB.has(trigram)) {
      intersection++;
    }
  }
  
  // Jaccard similarity: |A ∩ B| / |A ∪ B|
  // |A ∪ B| = |A| + |B| - |A ∩ B|
  const union = trigramsA.size + trigramsB.size - intersection;
  return intersection / union;
}

// ============================================================================
// Fuzzy Search Thresholds
// ============================================================================

export const FUZZY_THRESHOLDS = {
  EXACT: 0.9,       // Near-exact match
  HIGH: 0.7,        // Strong fuzzy match
  MODERATE: 0.5,    // Moderate fuzzy match
  LOW: 0.3,         // Weak fuzzy match
  MINIMUM: 0.2,     // Absolute minimum
};

/**
 * Determines if similarity meets threshold
 */
export function meetsFuzzyThreshold(
  similarity: number,
  threshold: keyof typeof FUZZY_THRESHOLDS = 'MODERATE'
): boolean {
  return similarity >= FUZZY_THRESHOLDS[threshold];
}

// ============================================================================
// Word-Level Fuzzy Matching
// ============================================================================

/**
 * Finds fuzzy matches at the word level
 * Useful for matching individual words in a phrase
 */
export function findFuzzyWordMatches(
  query: string,
  target: string,
  threshold: number = FUZZY_THRESHOLDS.MODERATE
): Array<{ word: string; similarity: number }> {
  const queryWords = tokenize(query);
  const targetWords = tokenize(target);
  const matches: Array<{ word: string; similarity: number }> = [];
  
  for (const qWord of queryWords) {
    let bestMatch = { word: '', similarity: 0 };
    
    for (const tWord of targetWords) {
      const sim = trigramSimilarity(qWord, tWord);
      if (sim > bestMatch.similarity) {
        bestMatch = { word: tWord, similarity: sim };
      }
    }
    
    if (bestMatch.similarity >= threshold) {
      matches.push(bestMatch);
    }
  }
  
  return matches;
}

/**
 * Calculates overall fuzzy score for a phrase match
 */
export function calculatePhraseFuzzyScore(
  query: string,
  target: string,
  threshold: number = FUZZY_THRESHOLDS.MODERATE
): number {
  const queryWords = tokenize(query);
  if (queryWords.length === 0) return 0;
  
  const matches = findFuzzyWordMatches(query, target, threshold);
  
  // Score based on percentage of words matched
  const matchRatio = matches.length / queryWords.length;
  
  // Average similarity of matches
  const avgSimilarity = matches.length > 0
    ? matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length
    : 0;
  
  return matchRatio * avgSimilarity;
}

// ============================================================================
// "Did You Mean" Suggestions
// ============================================================================

/**
 * Common misspellings and their corrections
 */
const COMMON_MISSPELLINGS: Record<string, string> = {
  'sofware': 'software',
  'softare': 'software',
  'developr': 'developer',
  'develper': 'developer',
  'enginer': 'engineer',
  'engieer': 'engineer',
  'progrmmer': 'programmer',
  'programer': 'programmer',
  'managr': 'manager',
  'manger': 'manager',
  'desiger': 'designer',
  'analyst': 'analyst',
  'anaylst': 'analyst',
  'remot': 'remote',
  'remorte': 'remote',
  'hybrd': 'hybrid',
  'hibrid': 'hybrid',
  'senor': 'senior',
  'senoir': 'senior',
  'juior': 'junior',
  'junor': 'junior',
  'experinced': 'experienced',
  'experienced': 'experienced',
  'intership': 'internship',
  'internshp': 'internship',
  'entry leve': 'entry level',
  'entery level': 'entry level',
};

/**
 * Suggests corrections for a potentially misspelled query
 */
export function suggestCorrection(query: string): string | undefined {
  const normalized = normalizeText(query);
  const words = tokenize(normalized);
  const corrections: string[] = [];
  let hasCorrection = false;
  
  for (const word of words) {
    // Check common misspellings
    if (COMMON_MISSPELLINGS[word]) {
      corrections.push(COMMON_MISSPELLINGS[word]);
      hasCorrection = true;
    } else {
      // Check if any common word is similar
      let bestMatch: string | null = null;
      let bestSim = 0;
      
      for (const [misspelled, correct] of Object.entries(COMMON_MISSPELLINGS)) {
        const sim = trigramSimilarity(word, misspelled);
        if (sim > bestSim && sim >= FUZZY_THRESHOLDS.HIGH) {
          bestSim = sim;
          bestMatch = correct;
        }
      }
      
      if (bestMatch) {
        corrections.push(bestMatch);
        hasCorrection = true;
      } else {
        corrections.push(word);
      }
    }
  }
  
  return hasCorrection ? corrections.join(' ') : undefined;
}

/**
 * Generates alternative search suggestions
 */
export function generateAlternatives(query: string): string[] {
  const alternatives: string[] = [];
  const normalized = normalizeText(query);
  
  // Common alternative phrasings
  const alternatives_map: Record<string, string[]> = {
    'software engineer': ['software developer', 'programmer', 'coder'],
    'web developer': ['frontend developer', 'website developer'],
    'frontend': ['frontend developer', 'ui developer', 'client-side'],
    'backend': ['backend developer', 'server-side developer', 'api developer'],
    'fullstack': ['full stack developer', 'full-stack engineer'],
    'devops': ['site reliability engineer', 'platform engineer', 'infrastructure engineer'],
    'data scientist': ['machine learning engineer', 'data analyst', 'ml researcher'],
    'product manager': ['pm', 'product owner', 'program manager'],
    'ux designer': ['user experience designer', 'ui/ux designer'],
    'qa': ['quality assurance', 'tester', 'test engineer'],
  };
  
  // Check for exact matches
  if (alternatives_map[normalized]) {
    alternatives.push(...alternatives_map[normalized]);
  }
  
  // Check for partial matches
  for (const [key, alts] of Object.entries(alternatives_map)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      // Don't add the query itself
      const newAlts = alts.filter(alt => normalizeText(alt) !== normalized);
      alternatives.push(...newAlts);
    }
  }
  
  return [...new Set(alternatives)].slice(0, 3);  // Max 3 unique alternatives
}

// ============================================================================
// PostgreSQL Fuzzy Query Helpers
// ============================================================================

/**
 * Generates SQL for fuzzy matching using pg_trgm
 * These are the conditions you would add to a WHERE clause
 */
export function generateFuzzySqlConditions(
  query: string,
  column: string,
  threshold: number = FUZZY_THRESHOLDS.MODERATE
): string {
  // PostgreSQL pg_trgm syntax
  return `${column} % '${query.replace(/'/g, "''")}'`;
}

/**
 * Generates similarity threshold condition
 */
export function generateSimilarityCondition(
  query: string,
  column: string,
  threshold: number = FUZZY_THRESHOLDS.MODERATE
): string {
  return `similarity(${column}, '${query.replace(/'/g, "''")}') >= ${threshold}`;
}

// ============================================================================
// Fallback Search
// ============================================================================

/**
 * Performs fuzzy matching as a fallback when no exact matches are found
 * Returns jobs ranked by fuzzy relevance
 */
export function fuzzyMatchFallback(
  query: string,
  candidates: Array<{ id: string; title: string; company: string | null; location: string | null }>,
  maxResults: number = 20
): Array<{ id: string; fuzzyScore: number; matches: string[] }> {
  const results = candidates.map(candidate => {
    const scores: Array<{ field: string; score: number }> = [];
    
    // Score title
    const titleScore = trigramSimilarity(query, candidate.title);
    if (titleScore >= FUZZY_THRESHOLDS.LOW) {
      scores.push({ field: 'title', score: titleScore });
    }
    
    // Score company
    if (candidate.company) {
      const companyScore = trigramSimilarity(query, candidate.company);
      if (companyScore >= FUZZY_THRESHOLDS.LOW) {
        scores.push({ field: 'company', score: companyScore });
      }
    }
    
    // Score location
    if (candidate.location) {
      const locationScore = trigramSimilarity(query, candidate.location);
      if (locationScore >= FUZZY_THRESHOLDS.LOW) {
        scores.push({ field: 'location', score: locationScore });
      }
    }
    
    // Use best score
    const bestScore = scores.length > 0
      ? Math.max(...scores.map(s => s.score))
      : 0;
    
    return {
      id: candidate.id,
      fuzzyScore: bestScore,
      matches: scores.map(s => s.field),
    };
  });
  
  // Filter and sort
  return results
    .filter(r => r.fuzzyScore >= FUZZY_THRESHOLDS.MINIMUM)
    .sort((a, b) => b.fuzzyScore - a.fuzzyScore)
    .slice(0, maxResults);
}

// ============================================================================
// Performance Optimizations
// ============================================================================

// Cache for trigram calculations (simple LRU)
const trigramCache = new Map<string, Set<string>>();
const MAX_TRIGRAM_CACHE = 5000;

/**
 * Gets cached trigrams or generates new ones
 */
export function getCachedTrigrams(text: string): Set<string> {
  const normalized = normalizeText(text);
  
  if (trigramCache.has(normalized)) {
    return trigramCache.get(normalized)!;
  }
  
  const trigrams = generateTrigrams(normalized);
  
  // Manage cache size
  if (trigramCache.size >= MAX_TRIGRAM_CACHE) {
    const firstKey = trigramCache.keys().next().value;
    if (firstKey !== undefined) {
      trigramCache.delete(firstKey);
    }
  }
  
  trigramCache.set(normalized, trigrams);
  return trigrams;
}

/**
 * Fast trigram similarity using cache
 */
export function cachedTrigramSimilarity(a: string, b: string): number {
  const trigramsA = getCachedTrigrams(a);
  const trigramsB = getCachedTrigrams(b);
  
  if (trigramsA.size === 0 && trigramsB.size === 0) return 1;
  if (trigramsA.size === 0 || trigramsB.size === 0) return 0;
  
  let intersection = 0;
  for (const trigram of trigramsA) {
    if (trigramsB.has(trigram)) {
      intersection++;
    }
  }
  
  const union = trigramsA.size + trigramsB.size - intersection;
  return intersection / union;
}
