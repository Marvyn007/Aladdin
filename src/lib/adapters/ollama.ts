/**
 * Ollama Local AI Adapter - Robust Implementation
 * 
 * Primary: phi3:mini (~2GB RAM, fast)
 * Fallback: qwen2.5:3b (~2GB RAM)
 * 
 * Features:
 * - Robust health check with model fallback
 * - Never throws on health check - returns structured status
 * - 90 second generation timeout (expect <20s for phi3:mini)
 * - Timeout is NOT treated as provider failure
 */

// Configuration from environment
const getConfig = () => ({
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    primaryModel: process.env.OLLAMA_MODEL || 'phi3:mini',
    fallbackModel: process.env.OLLAMA_FALLBACK_MODEL || 'qwen2.5:3b'
});

const HEALTH_CHECK_TIMEOUT_MS = 10000; // 10s for health check
const GENERATION_TIMEOUT_MS = 90000;   // 90s for generation (CPU models are slow!)

// Input size limits for prompt truncation (reduced for faster generation)
export const INPUT_LIMITS = {
    JOB_TEXT: 2500,
    RESUME_TEXT: 2000,
    LINKEDIN_TEXT: 1500
};

// Cached status
let lastHealthResult: OllamaHealthResult | null = null;
let lastHealthCheckTime = 0;
const HEALTH_CACHE_MS = 30000; // Cache for 30 seconds

export interface OllamaHealthResult {
    available: boolean;
    model_used: string | null;
    latency_ms: number | null;
    errors: string[];
    note?: string;
}

export interface OllamaGenerateResult {
    success: boolean;
    text: string;
    model: string;
    elapsed_ms: number;
    error?: string;
    isTimeout?: boolean;
}

/**
 * Truncate text to specified length with logging
 */
export function truncateInput(text: string, maxLength: number, label: string): string {
    if (!text) return '';
    const original = text.length;
    if (original <= maxLength) {
        return text;
    }
    const truncated = text.slice(0, maxLength);
    console.log(`[Ollama] Truncated ${label}: ${original} → ${maxLength} chars`);
    return truncated;
}

/**
 * Robust Ollama health check with fallback model support
 * NEVER throws - returns structured result
 */
export async function checkOllama(): Promise<OllamaHealthResult> {
    // Return cached result if recent
    if (lastHealthResult && Date.now() - lastHealthCheckTime < HEALTH_CACHE_MS) {
        return lastHealthResult;
    }

    const config = getConfig();
    const errors: string[] = [];

    // Try primary model first
    const primaryResult = await tryModel(config.baseUrl, config.primaryModel);
    if (primaryResult.success) {
        const result: OllamaHealthResult = {
            available: true,
            model_used: config.primaryModel,
            latency_ms: primaryResult.latency_ms,
            errors: []
        };
        lastHealthResult = result;
        lastHealthCheckTime = Date.now();
        console.log(`[Ollama] ✓ Health check passed with ${config.primaryModel} (${primaryResult.latency_ms}ms)`);
        return result;
    }

    errors.push(`${config.primaryModel}: ${primaryResult.error}`);
    console.log(`[Ollama] Primary model failed: ${primaryResult.error}`);

    // Try fallback model
    const fallbackResult = await tryModel(config.baseUrl, config.fallbackModel);
    if (fallbackResult.success) {
        const result: OllamaHealthResult = {
            available: true,
            model_used: config.fallbackModel,
            latency_ms: fallbackResult.latency_ms,
            errors: [],
            note: 'Used fallback model'
        };
        lastHealthResult = result;
        lastHealthCheckTime = Date.now();
        console.log(`[Ollama] ✓ Fallback model ${config.fallbackModel} works (${fallbackResult.latency_ms}ms)`);
        return result;
    }

    errors.push(`${config.fallbackModel}: ${fallbackResult.error}`);
    console.log(`[Ollama] Fallback model also failed: ${fallbackResult.error}`);

    // Both failed
    const result: OllamaHealthResult = {
        available: false,
        model_used: null,
        latency_ms: null,
        errors
    };
    lastHealthResult = result;
    lastHealthCheckTime = Date.now();
    return result;
}

/**
 * Try a specific model with a tiny generation (health check)
 */
async function tryModel(baseUrl: string, model: string): Promise<{
    success: boolean;
    latency_ms: number;
    error?: string;
}> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);

    try {
        const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt: 'Reply OK.',
                stream: false,
                options: {
                    num_predict: 8
                }
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const latency_ms = Date.now() - start;

        if (!response.ok) {
            const text = await response.text().catch(() => '');

            // Check for memory errors
            if (text.toLowerCase().includes('memory') || text.toLowerCase().includes('ram')) {
                return {
                    success: false,
                    latency_ms,
                    error: `RAM insufficient: ${text.slice(0, 100)}`
                };
            }

            // Check for model not found
            if (text.toLowerCase().includes('not found') || response.status === 404) {
                return {
                    success: false,
                    latency_ms,
                    error: `Model not found: ${model}`
                };
            }

            return {
                success: false,
                latency_ms,
                error: `HTTP ${response.status}: ${text.slice(0, 100)}`
            };
        }

        const data = await response.json();
        return { success: true, latency_ms };

    } catch (error: any) {
        clearTimeout(timeoutId);
        const latency_ms = Date.now() - start;

        if (error.name === 'AbortError') {
            return { success: false, latency_ms, error: `Timeout after ${HEALTH_CHECK_TIMEOUT_MS}ms` };
        }

        // Handle connection errors
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
            return { success: false, latency_ms, error: 'Connection refused (Ollama not running?)' };
        }

        return { success: false, latency_ms, error: error.message || 'Unknown error' };
    }
}

/**
 * Get cached health status
 */
export function getCachedHealthStatus(): OllamaHealthResult | null {
    if (lastHealthResult && Date.now() - lastHealthCheckTime < HEALTH_CACHE_MS) {
        return lastHealthResult;
    }
    return null;
}

/**
 * Check if Ollama is considered available based on last health check
 */
export function isOllamaHealthy(): boolean {
    return lastHealthResult?.available === true;
}

/**
 * Call Ollama for text generation with proper timeout handling
 * 
 * IMPORTANT: Timeout is NOT treated as provider failure!
 * Only connection refused, model not found, or RAM errors disable Ollama.
 */
export async function callOllama(prompt: string): Promise<string> {
    const result = await generateWithOllama(prompt);

    if (!result.success) {
        throw new Error(result.error || 'Ollama generation failed');
    }

    return result.text;
}

/**
 * Generate text with Ollama - returns structured result
 * Does NOT throw on timeout - returns error info instead
 */
export async function generateWithOllama(prompt: string): Promise<OllamaGenerateResult> {
    const config = getConfig();
    const start = Date.now();

    // Use cached working model or default to primary
    const model = lastHealthResult?.model_used || config.primaryModel;

    console.log(`[AI Router] Using local Ollama (${model})`);
    console.log(`[Ollama] Prompt length: ${prompt.length} chars`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
        const response = await fetch(`${config.baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model,
                prompt,
                stream: false
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed_ms = Date.now() - start;

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');

            // Check for fatal errors that should disable Ollama
            const isFatal =
                errorText.toLowerCase().includes('memory') ||
                errorText.toLowerCase().includes('ram') ||
                errorText.toLowerCase().includes('not found') ||
                response.status === 404;

            if (isFatal) {
                // Clear health cache to force re-check
                lastHealthResult = null;
            }

            return {
                success: false,
                text: '',
                model,
                elapsed_ms,
                error: `Ollama HTTP ${response.status}: ${errorText.slice(0, 200)}`
            };
        }

        const data = await response.json();

        if (!data.response) {
            return {
                success: false,
                text: '',
                model,
                elapsed_ms,
                error: 'Ollama returned empty response'
            };
        }

        console.log(`[Ollama] ✓ Generated ${data.response.length} chars in ${elapsed_ms}ms`);
        return {
            success: true,
            text: data.response,
            model,
            elapsed_ms
        };

    } catch (error: any) {
        clearTimeout(timeoutId);
        const elapsed_ms = Date.now() - start;

        if (error.name === 'AbortError') {
            // IMPORTANT: Timeout is NOT a fatal error - Ollama is still healthy, just slow
            console.warn(`[Ollama] Generation slow — timed out after ${GENERATION_TIMEOUT_MS}ms`);
            return {
                success: false,
                text: '',
                model,
                elapsed_ms,
                error: `Generation timed out after ${GENERATION_TIMEOUT_MS / 1000}s. Local AI is still working — please wait or retry.`,
                isTimeout: true
            };
        }

        // Connection refused IS a fatal error
        if (error.code === 'ECONNREFUSED' || error.message?.includes('ECONNREFUSED') || error.cause?.code === 'ECONNREFUSED') {
            lastHealthResult = null; // Force re-check
            return {
                success: false,
                text: '',
                model,
                elapsed_ms,
                error: 'Connection refused (Ollama not running?)'
            };
        }

        return {
            success: false,
            text: '',
            model,
            elapsed_ms,
            error: error.message || 'Unknown error'
        };
    }
}

/**
 * Get Ollama configuration for debugging
 */
export function getOllamaConfig(): {
    baseUrl: string;
    primaryModel: string;
    fallbackModel: string;
    generationTimeoutMs: number;
    lastHealthCheck: OllamaHealthResult | null;
    lastCheckTime: string | null;
} {
    const config = getConfig();
    return {
        baseUrl: config.baseUrl,
        primaryModel: config.primaryModel,
        fallbackModel: config.fallbackModel,
        generationTimeoutMs: GENERATION_TIMEOUT_MS,
        lastHealthCheck: lastHealthResult,
        lastCheckTime: lastHealthCheckTime ? new Date(lastHealthCheckTime).toISOString() : null
    };
}

/**
 * Reset cached state (for testing)
 */
export function resetOllamaCache(): void {
    lastHealthResult = null;
    lastHealthCheckTime = 0;
}
