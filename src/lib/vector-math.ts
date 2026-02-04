/**
 * Vector Math Utilities for AI Recommendations
 */

// Calculate magnitude of a vector
export function magnitude(vector: number[]): number {
    return Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
}

// Normalize a vector to unit length
export function normalize(vector: number[]): number[] {
    const mag = magnitude(vector);
    if (mag === 0) return vector;
    return vector.map(val => val / mag);
}

// Calculate cosine similarity between two vectors
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
    const dotProduct = vecA.reduce((sum, val, i) => sum + val * vecB[i], 0);
    const magA = magnitude(vecA);
    const magB = magnitude(vecB);
    if (magA === 0 || magB === 0) return 0;
    return dotProduct / (magA * magB);
}

// Weighted average of two vectors
// result = normalize(vecA * (1 - weight) + vecB * weight)
export function weightedAverage(currentVec: number[], newVec: number[], weight: number): number[] {
    if (currentVec.length !== newVec.length) {
        throw new Error(`Vector dimension mismatch: ${currentVec.length} vs ${newVec.length}`);
    }

    const blended = currentVec.map((val, i) => {
        return val * (1 - weight) + newVec[i] * weight;
    });

    return normalize(blended);
}
