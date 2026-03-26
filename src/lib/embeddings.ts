/**
 * embeddings.ts
 * Generates text embeddings for semantic search.
 * Currently returns a zero vector — semantic search gracefully degrades
 * to keyword-only results when no real embedding model is configured.
 */

const EMBEDDING_DIMENSIONS = 384;

/**
 * Generates a numerical embedding for the given text.
 * Replace this implementation with a real model (e.g. OpenAI, Xenova/transformers)
 * when semantic vector search is needed.
 */
export async function generateEmbedding(_text: string): Promise<number[]> {
  return new Array(EMBEDDING_DIMENSIONS).fill(0);
}
