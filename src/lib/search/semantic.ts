/**
 * Semantic Search Module
 * Handles vector embeddings and cosine similarity using Xenova/transformers
 */

import { generateEmbedding as generateXenovaEmbedding } from '@/lib/embeddings';
import type { CachedEmbedding } from './types';

// ============================================================================
// Embedding Cache
// ============================================================================

// Simple in-memory cache for query embeddings (LRU with 1000 entries)
const embeddingCache = new Map<string, CachedEmbedding>();
const MAX_CACHE_SIZE = 1000;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Gets cached embedding or generates new one
 */
export async function getQueryEmbedding(query: string): Promise<number[]> {
  const normalized = query.toLowerCase().trim();
  const cached = embeddingCache.get(normalized);
  
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    return cached.embedding;
  }
  
  // Generate new embedding
  const embedding = await generateXenovaEmbedding(normalized);
  
  // Cache the result
  if (embeddingCache.size >= MAX_CACHE_SIZE) {
    // Remove oldest entry (first in map)
    const firstKey = embeddingCache.keys().next().value;
    if (firstKey !== undefined) {
      embeddingCache.delete(firstKey);
    }
  }
  
  embeddingCache.set(normalized, {
    query: normalized,
    embedding,
    timestamp: Date.now(),
  });
  
  return embedding;
}

/**
 * Clears the embedding cache
 */
export function clearEmbeddingCache(): void {
  embeddingCache.clear();
}

/**
 * Gets cache stats for monitoring
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return {
    size: embeddingCache.size,
    maxSize: MAX_CACHE_SIZE,
  };
}

// ============================================================================
// Cosine Similarity
// ============================================================================

/**
 * Calculates cosine similarity between two vectors
 * Returns value in range [-1, 1], but typically [0, 1] for normalized embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) {
    return 0;
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizes similarity to 0-1 range
 * Useful when using pgvector which returns raw cosine distance
 */
export function normalizeSimilarity(similarity: number): number {
  // Cosine similarity is typically in [-1, 1] range
  // For normalized embeddings (like from Xenova), it's typically [0, 1]
  // We clamp to [0, 1] and ensure it's not negative
  return Math.max(0, Math.min(1, (similarity + 1) / 2));
}

/**
 * Converts cosine distance (from pgvector) to similarity
 * pgvector uses: distance = 1 - similarity (for cosine)
 */
export function distanceToSimilarity(distance: number): number {
  return 1 - distance;
}

// ============================================================================
// Batch Processing
// ============================================================================

/**
 * Finds top-k most similar embeddings from a list
 */
export function findTopKSimilar(
  queryEmbedding: number[],
  candidates: Array<{ id: string; embedding: number[] }>,
  k: number
): Array<{ id: string; similarity: number }> {
  const scored = candidates.map(candidate => ({
    id: candidate.id,
    similarity: cosineSimilarity(queryEmbedding, candidate.embedding),
  }));
  
  // Sort by similarity descending
  scored.sort((a, b) => b.similarity - a.similarity);
  
  return scored.slice(0, k);
}

// ============================================================================
// Query Expansion
// ============================================================================

/**
 * Expands a search query with related terms for better semantic matching
 * This helps bridge the gap between exact and semantic search
 */
export function expandQueryForSemantic(query: string): string {
  const normalized = query.toLowerCase().trim();
  
  // Add context to help with semantic understanding
  const expansions: Record<string, string> = {
    // Programming roles
    'software engineer': 'software engineer developer programmer coding',
    'software developer': 'software developer engineer programmer coding',
    'web developer': 'web developer frontend backend fullstack javascript',
    'frontend': 'frontend engineer developer react angular vue javascript',
    'backend': 'backend engineer developer api server database',
    'fullstack': 'fullstack full-stack developer frontend backend javascript',
    'mobile': 'mobile developer ios android swift kotlin react-native',
    
    // Data roles
    'data scientist': 'data scientist machine learning ml ai analytics',
    'data engineer': 'data engineer etl pipeline database warehouse',
    'ml engineer': 'machine learning ml engineer ai model deployment',
    
    // DevOps
    'devops': 'devops engineer sre platform infrastructure cloud aws',
    'sre': 'site reliability engineer sre devops infrastructure',
    
    // Management
    'engineering manager': 'engineering manager tech lead team lead people',
    'tech lead': 'tech lead technical lead engineering architect',
    'product manager': 'product manager pm product owner agile',
    
    // Design
    'ux designer': 'ux designer user experience ui interface design',
    'ui designer': 'ui designer user interface ux visual design',
    
    // QA
    'qa': 'qa quality assurance tester testing automation',
    'tester': 'software tester qa quality assurance manual automated',
  };
  
  // Check for exact matches first
  if (expansions[normalized]) {
    return expansions[normalized];
  }
  
  // Check for partial matches
  for (const [key, expansion] of Object.entries(expansions)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return `${normalized} ${expansion}`;
    }
  }
  
  return normalized;
}

/**
 * Creates a rich embedding by combining query with expanded terms
 */
export async function generateRichEmbedding(query: string): Promise<number[]> {
  const expanded = expandQueryForSemantic(query);
  return getQueryEmbedding(expanded);
}

// ============================================================================
// Similarity Thresholds
// ============================================================================

/**
 * Minimum similarity thresholds for semantic matching
 */
export const SIMILARITY_THRESHOLDS = {
  EXCELLENT: 0.85,  // Very strong semantic match
  GOOD: 0.70,       // Strong match
  MODERATE: 0.55,   // Moderate match
  WEAK: 0.40,       // Weak match
  MINIMUM: 0.30,    // Absolute minimum to consider
};

/**
 * Checks if a similarity score meets the threshold
 */
export function isSimilarityRelevant(
  similarity: number,
  threshold: keyof typeof SIMILARITY_THRESHOLDS = 'MODERATE'
): boolean {
  return similarity >= SIMILARITY_THRESHOLDS[threshold];
}

// ============================================================================
// Job Description Processing
// ============================================================================

/**
 * Extracts searchable text from a job for embedding
 * Combines title, company, and description with different weights
 */
export function extractJobTextForEmbedding(
  title: string,
  company: string | null,
  location: string | null,
  description: string | null
): string {
  const parts: string[] = [];
  
  // Title gets highest weight (repeat it)
  if (title) {
    parts.push(title, title);  // Repeat for weight
  }
  
  // Company is also important
  if (company) {
    parts.push(company);
  }
  
  // Location context
  if (location) {
    parts.push(location);
  }
  
  // Description provides semantic context
  if (description) {
    // Truncate description to avoid overwhelming the embedding
    const truncated = description.substring(0, 2000);
    parts.push(truncated);
  }
  
  return parts.join('. ');
}

// ============================================================================
// PostgreSQL Integration Helpers
// ============================================================================

/**
 * Converts an embedding array to PostgreSQL vector string format
 * Format: '[x,y,z,...]'
 */
export function embeddingToPostgresVector(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

/**
 * Parses PostgreSQL vector string to array
 * Handles formats: '[x,y,z]' or '{x,y,z}'
 */
export function parsePostgresVector(vectorStr: string): number[] {
  // Remove brackets and split by comma
  const cleaned = vectorStr.replace(/[\[\]{}]/g, '');
  return cleaned.split(',').map(s => parseFloat(s.trim()));
}

// ============================================================================
// Performance Optimizations
// ============================================================================

/**
 * Pre-filters candidates by vector similarity threshold
 * This should be done in SQL with pgvector for efficiency
 * This function is for client-side filtering if needed
 */
export function filterBySimilarityThreshold(
  results: Array<{ id: string; similarity: number }>,
  threshold: number = SIMILARITY_THRESHOLDS.MINIMUM
): Array<{ id: string; similarity: number }> {
  return results.filter(r => r.similarity >= threshold);
}

/**
 * Combines multiple similarity scores (for ensemble approaches)
 * Uses weighted average
 */
export function combineSimilarities(
  similarities: Array<{ score: number; weight: number }>
): number {
  if (similarities.length === 0) return 0;
  
  const totalWeight = similarities.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  
  const weightedSum = similarities.reduce((sum, s) => sum + s.score * s.weight, 0);
  return weightedSum / totalWeight;
}
