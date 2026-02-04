import { pipeline } from '@xenova/transformers';

// Global typed variable to prevent multiple model loads in development
declare global {
    var embeddingPipeline: any;
}

const MODEL_NAME = 'Xenova/all-MiniLM-L6-v2';

// Singleton to load the model lazily
async function getPipeline() {
    if (global.embeddingPipeline) {
        return global.embeddingPipeline;
    }

    console.log(`Loading embedding model: ${MODEL_NAME}...`);
    const pipe = await pipeline('feature-extraction', MODEL_NAME);
    global.embeddingPipeline = pipe;
    return pipe;
}

/**
 * Generates an embedding for a given text using all-MiniLM-L6-v2
 * Returns a 384-dimensional number array.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
        throw new Error('Cannot generate embedding for empty text');
    }

    // Preprocess: Replace newlines with spaces to improve semantic matching
    const cleanText = text.replace(/\n/g, ' ').trim();

    // Truncate to ~512 tokens (roughly 2000 chars safe estimate) if naive
    // but let's just pass it in, the model handles truncation usually or we catch error
    // For safety, let's limit char length to avoid memory spikes
    const truncatedText = cleanText.substring(0, 8000);

    const pipe = await getPipeline();

    // pooling: 'mean' or 'cls'? standard is mean pooling for sentence-transformers
    const output = await pipe(truncatedText, { pooling: 'mean', normalize: true });

    // output.data is Float32Array
    return Array.from(output.data);
}
