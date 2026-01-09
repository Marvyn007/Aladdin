/**
 * Hugging Face Inference API Adapter
 * Uses free inference models: zephyr-7b-beta (primary), Mistral-7B-Instruct (fallback)
 */

export interface HFGenerationParams {
    max_new_tokens?: number;
    temperature?: number;
    do_sample?: boolean;
    return_full_text?: boolean;
}

// Supported free models in priority order
const MODELS = [
    'HuggingFaceH4/zephyr-7b-beta',
    'mistralai/Mistral-7B-Instruct-v0.2'
];

// Track permanently disabled models (410/404)
const disabledModels = new Set<string>();

const TIMEOUT_MS = 15000; // 15 second timeout
const HF_API_BASE = 'https://api-inference.huggingface.co/models';

/**
 * Call Hugging Face Inference API with automatic model fallback
 */
export async function callHuggingFace(
    prompt: string,
    specificModel?: string,
    params?: HFGenerationParams
): Promise<string> {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
        throw new Error('HUGGINGFACE_API_KEY not configured');
    }

    // Build list of models to try
    const modelsToTry = specificModel
        ? [specificModel]
        : MODELS.filter(m => !disabledModels.has(m));

    if (modelsToTry.length === 0) {
        throw new Error('All Hugging Face models are disabled');
    }

    let lastError: Error | null = null;

    for (const modelId of modelsToTry) {
        try {
            const result = await callModel(apiKey, modelId, prompt, params);
            console.log(`[HuggingFace] ✓ Success with model: ${modelId}`);
            return result;
        } catch (error: any) {
            lastError = error;
            console.warn(`[HuggingFace] Model ${modelId} failed: ${error.message}`);

            // Check for permanent failures (410 Gone, 404 Not Found)
            if (error.message.includes('410') || error.message.includes('404')) {
                console.error(`[HuggingFace] Model ${modelId} permanently disabled (${error.message})`);
                disabledModels.add(modelId);
            }

            // Continue to next model
        }
    }

    throw new Error(`All Hugging Face models failed. Last error: ${lastError?.message}`);
}

/**
 * Call a specific HF model with retry logic for 503
 */
async function callModel(
    apiKey: string,
    modelId: string,
    prompt: string,
    params?: HFGenerationParams,
    retryCount = 0
): Promise<string> {
    const url = `${HF_API_BASE}/${modelId}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
        console.log(`[HuggingFace] Calling model: ${modelId}${retryCount > 0 ? ` (retry ${retryCount})` : ''}`);

        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-Wait-For-Model': 'true'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_new_tokens: params?.max_new_tokens ?? 500,
                    temperature: params?.temperature ?? 0.3,
                    do_sample: params?.do_sample ?? false,
                    return_full_text: false
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Handle specific status codes
        if (!response.ok) {
            const errorText = await response.text();

            // 503: Model busy/loading - retry ONCE
            if (response.status === 503 && retryCount < 1) {
                const data = tryParseJson(errorText);
                const waitTime = data?.estimated_time ? Math.min(data.estimated_time * 1000, 5000) : 2000;
                console.log(`[HuggingFace] Model busy (503), waiting ${waitTime}ms then retrying...`);
                await sleep(waitTime);
                return callModel(apiKey, modelId, prompt, params, retryCount + 1);
            }

            // 429: Rate limit
            if (response.status === 429) {
                throw new Error(`Rate limit (429): ${errorText}`);
            }

            // 410/404: Model deprecated or not found - will be disabled by caller
            if (response.status === 410) {
                throw new Error(`Model deprecated (410): ${modelId}`);
            }
            if (response.status === 404) {
                throw new Error(`Model not found (404): ${modelId}`);
            }

            throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 200)}`);
        }

        const data = await response.json();

        // Parse response - text generation returns [{ generated_text: "..." }]
        if (Array.isArray(data) && data[0]?.generated_text) {
            console.log(`[HuggingFace] Response received (${data[0].generated_text.length} chars)`);
            return data[0].generated_text;
        }

        if (typeof data === 'object' && data.generated_text) {
            console.log(`[HuggingFace] Response received (${data.generated_text.length} chars)`);
            return data.generated_text;
        }

        console.warn('[HuggingFace] Unexpected response format:', JSON.stringify(data).slice(0, 100));
        return JSON.stringify(data);

    } catch (error: any) {
        clearTimeout(timeoutId);

        if (error.name === 'AbortError') {
            throw new Error(`Timeout after ${TIMEOUT_MS}ms`);
        }

        throw error;
    }
}

function tryParseJson(text: string): any {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if Hugging Face is available (has any non-disabled models)
 */
export function isHuggingFaceAvailable(): boolean {
    return MODELS.some(m => !disabledModels.has(m));
}

/**
 * Get status of Hugging Face models
 */
export function getHuggingFaceStatus(): { available: string[]; disabled: string[] } {
    return {
        available: MODELS.filter(m => !disabledModels.has(m)),
        disabled: Array.from(disabledModels)
    };
}
