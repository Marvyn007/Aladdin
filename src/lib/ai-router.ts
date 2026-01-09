/**
 * AI Provider Router - OpenRouter-First Architecture
 * 
 * Priority: OPENROUTER → OLLAMA (fallback)
 * 
 * OpenRouter Models:
 * - Primary: google/gemini-flash-1.5
 * - Fallback: anthropic/claude-3-haiku
 * 
 * Features:
 * - OpenRouter is PRIMARY for reliability
 * - Ollama is OPTIONAL fallback only
 * - Structured response with provider info
 * - 30s timeout for cloud, 90s for local
 */

import { checkOllama, callOllama, isOllamaHealthy } from './adapters/ollama';
import { getProviderStats, updateProviderStats } from './db';

// ============================================================================
// TYPES
// ============================================================================

export type ProviderHealth = 'healthy' | 'rate_limited' | 'unavailable' | 'disabled_billing';

export interface ProviderState {
    name: string;
    health: ProviderHealth;
    lastError: string | null;
    callsToday: number;
    maxCallsPerDay: number;
}

export interface AIGenerateResult {
    success: boolean;
    provider: string;
    model: string;
    text: string;
    elapsed_ms: number;
    error?: string;
}

export interface AIRouterState {
    openRouter: ProviderState;
    ollama: {
        available: boolean;
        lastCheck: number;
    };
    activeProvider: string | null;
    lastSuccessfulProvider: string | null;
    lastError: string | null;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OPENROUTER_TIMEOUT_MS = 30000; // 30s for cloud
const OLLAMA_TIMEOUT_MS = 90000;     // 90s for local
const MAX_PROMPT_SIZE = 6000;        // Hard limit

const OPENROUTER_DAILY_LIMIT = parseInt(process.env.OPENROUTER_MAX_CALLS_PER_DAY || '100');

// OpenRouter models
const OPENROUTER_PRIMARY_MODEL = process.env.OPENROUTER_MODEL || 'google/gemini-flash-1.5';
const OPENROUTER_FALLBACK_MODEL = process.env.OPENROUTER_FALLBACK_MODEL || 'anthropic/claude-3-haiku';

const BILLING_ERROR_PATTERNS = ['insufficient credits', 'payment required', 'billing', 'no credits', '402'];
const RATE_LIMIT_PATTERNS = ['429', 'rate limit', 'quota exceeded', 'too many requests'];

// ============================================================================
// STATE
// ============================================================================

const routerState: AIRouterState = {
    openRouter: {
        name: 'OpenRouter',
        health: 'healthy',
        lastError: null,
        callsToday: 0,
        maxCallsPerDay: OPENROUTER_DAILY_LIMIT
    },
    ollama: {
        available: false,
        lastCheck: 0
    },
    activeProvider: null,
    lastSuccessfulProvider: null,
    lastError: null
};

let initialized = false;

// ============================================================================
// INITIALIZATION
// ============================================================================

async function initialize(): Promise<void> {
    if (initialized) return;
    initialized = true;

    // Check OpenRouter key
    if (!process.env.OPENROUTER_API_KEY) {
        routerState.openRouter.health = 'unavailable';
        console.log('[AI Router] OpenRouter not configured (no API key)');
    } else {
        await syncOpenRouterState();
        console.log('[AI Router] OpenRouter ready (primary provider)');
    }
}

async function syncOpenRouterState(): Promise<void> {
    const stored = await getProviderStats('openrouter');
    const today = new Date().toISOString().split('T')[0];

    if (stored) {
        if (stored.last_reset !== today) {
            console.log('[AI Router] Resetting OpenRouter daily limit');
            await updateProviderStats('openrouter', {
                status: stored.status === 'disabled_billing' ? 'disabled_billing' : 'healthy',
                calls_today: 0,
                last_reset: today
            });
            routerState.openRouter.callsToday = 0;
            if (routerState.openRouter.health !== 'disabled_billing') {
                routerState.openRouter.health = 'healthy';
            }
        } else {
            routerState.openRouter.callsToday = stored.calls_today;
            routerState.openRouter.health = stored.status as ProviderHealth;
        }
    } else {
        await updateProviderStats('openrouter', {
            status: 'healthy',
            calls_today: 0,
            last_reset: today
        });
    }
}

// ============================================================================
// OPENROUTER CALLER
// ============================================================================

async function callOpenRouterModel(prompt: string, model: string): Promise<AIGenerateResult> {
    const key = process.env.OPENROUTER_API_KEY!;
    const start = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), OPENROUTER_TIMEOUT_MS);

    console.log(`[AI Router] Trying OpenRouter (${model})...`);

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://usealaddin.com',
                'X-Title': 'Aladdin'
            },
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 2000
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const elapsed_ms = Date.now() - start;

        if (!response.ok) {
            const errorText = await response.text();

            // Check error type
            const isBilling = response.status === 402 || BILLING_ERROR_PATTERNS.some(p => errorText.toLowerCase().includes(p));
            const isRateLimit = response.status === 429 || RATE_LIMIT_PATTERNS.some(p => errorText.toLowerCase().includes(p));
            const isModelNotFound = response.status === 404 || errorText.includes('not found');

            return {
                success: false,
                provider: 'openrouter',
                model,
                text: '',
                elapsed_ms,
                error: isBilling ? 'billing_error' : isRateLimit ? 'rate_limit' : isModelNotFound ? 'model_not_found' : `HTTP ${response.status}`
            };
        }

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;

        if (!content) {
            return {
                success: false,
                provider: 'openrouter',
                model,
                text: '',
                elapsed_ms,
                error: 'Empty response from OpenRouter'
            };
        }

        console.log(`[OpenRouter] ✓ Generated ${content.length} chars in ${elapsed_ms}ms using ${model}`);
        return {
            success: true,
            provider: 'openrouter',
            model,
            text: content,
            elapsed_ms
        };

    } catch (error: any) {
        clearTimeout(timeoutId);
        const elapsed_ms = Date.now() - start;

        if (error.name === 'AbortError') {
            return {
                success: false,
                provider: 'openrouter',
                model,
                text: '',
                elapsed_ms,
                error: `Timeout after ${OPENROUTER_TIMEOUT_MS / 1000}s`
            };
        }

        return {
            success: false,
            provider: 'openrouter',
            model,
            text: '',
            elapsed_ms,
            error: error.message || 'Unknown error'
        };
    }
}

// ============================================================================
// AVAILABILITY CHECKS
// ============================================================================

function isOpenRouterAvailable(): boolean {
    const p = routerState.openRouter;
    if (p.health === 'unavailable') return false;
    if (p.health === 'disabled_billing') return false;
    if (p.callsToday >= p.maxCallsPerDay) return false;
    return true;
}

async function handleOpenRouterSuccess(): Promise<void> {
    routerState.openRouter.callsToday++;
    await updateProviderStats('openrouter', { calls_today: routerState.openRouter.callsToday });
}

async function handleOpenRouterError(errorType: string): Promise<void> {
    routerState.openRouter.lastError = errorType;
    routerState.lastError = `OpenRouter: ${errorType}`;

    if (errorType === 'billing_error') {
        console.error('[AI Router] OpenRouter DISABLED (Billing error)');
        routerState.openRouter.health = 'disabled_billing';
        await updateProviderStats('openrouter', { status: 'disabled_billing' });
    } else if (errorType === 'rate_limit') {
        console.warn('[AI Router] OpenRouter rate limited');
        routerState.openRouter.health = 'rate_limited';
    }
}

// ============================================================================
// MAIN ROUTER
// ============================================================================

/**
 * Truncate prompt to max size
 */
function truncatePrompt(prompt: string): string {
    if (prompt.length <= MAX_PROMPT_SIZE) return prompt;
    console.log(`[AI Router] Truncating prompt: ${prompt.length} → ${MAX_PROMPT_SIZE} chars`);
    return prompt.slice(0, MAX_PROMPT_SIZE);
}

/**
 * Route AI call to best available provider
 * 
 * Priority: OpenRouter Primary → OpenRouter Fallback → Ollama
 */
export async function routeAICall(prompt: string): Promise<string> {
    const result = await routeAICallWithDetails(prompt);

    if (!result.success) {
        throw new Error(result.error || 'AI generation failed');
    }

    return result.text;
}

/**
 * Route AI call and return detailed result with provider info
 */
export async function routeAICallWithDetails(prompt: string): Promise<AIGenerateResult> {
    await initialize();

    // Truncate prompt if too long
    const truncatedPrompt = truncatePrompt(prompt);

    // 1. Try OpenRouter Primary
    if (isOpenRouterAvailable()) {
        const result = await callOpenRouterModel(truncatedPrompt, OPENROUTER_PRIMARY_MODEL);

        if (result.success) {
            await handleOpenRouterSuccess();
            routerState.activeProvider = 'openrouter';
            routerState.lastSuccessfulProvider = 'openrouter';
            return result;
        }

        // Primary failed - try fallback model
        console.log(`[AI Router] Primary model failed (${result.error}), trying fallback...`);

        if (result.error !== 'billing_error') {
            const fallbackResult = await callOpenRouterModel(truncatedPrompt, OPENROUTER_FALLBACK_MODEL);

            if (fallbackResult.success) {
                await handleOpenRouterSuccess();
                routerState.activeProvider = 'openrouter';
                routerState.lastSuccessfulProvider = 'openrouter';
                return fallbackResult;
            }

            console.log(`[AI Router] Fallback model also failed: ${fallbackResult.error}`);
        }

        await handleOpenRouterError(result.error || 'unknown');
    }

    // 2. Try Ollama as last resort
    console.log('[AI Router] OpenRouter unavailable, trying Ollama...');

    const ollamaHealth = await checkOllama();
    routerState.ollama.available = ollamaHealth.available;
    routerState.ollama.lastCheck = Date.now();

    if (ollamaHealth.available) {
        try {
            const start = Date.now();
            const text = await callOllama(truncatedPrompt);
            const elapsed_ms = Date.now() - start;

            routerState.activeProvider = 'ollama';
            routerState.lastSuccessfulProvider = 'ollama';

            return {
                success: true,
                provider: 'ollama',
                model: ollamaHealth.model_used || 'unknown',
                text,
                elapsed_ms
            };
        } catch (error: any) {
            console.error(`[AI Router] Ollama failed: ${error.message}`);
            routerState.lastError = `Ollama: ${error.message}`;
        }
    }

    // 3. All providers failed
    routerState.activeProvider = null;
    const errorMsg = routerState.lastError || 'All AI providers are unavailable';

    return {
        success: false,
        provider: 'none',
        model: 'none',
        text: '',
        elapsed_ms: 0,
        error: errorMsg
    };
}

/**
 * Route multimodal call - NOT SUPPORTED via OpenRouter
 * This will always fail, triggering the text extraction fallback in gemini.ts
 */
export async function routeMultimodalCall(prompt: any[]): Promise<string> {
    // Check if this is a multimodal call with binary data
    const hasBinaryData = prompt.some(item =>
        typeof item === 'object' && item?.inlineData
    );

    if (hasBinaryData) {
        // OpenRouter/Claude do NOT support direct PDF parsing
        // Force the text extraction fallback by throwing an error
        throw new Error('Multimodal PDF parsing not supported by current provider. Using text extraction fallback.');
    }

    // If it's just text, route normally
    const textContent = prompt
        .filter(item => typeof item === 'string')
        .join('\n');

    if (!textContent) {
        throw new Error('No text content in multimodal call');
    }

    return routeAICall(textContent);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Check if any AI provider is available
 */
export async function isAIAvailable(): Promise<boolean> {
    await initialize();

    if (isOpenRouterAvailable()) return true;

    const ollamaHealth = await checkOllama();
    return ollamaHealth.available;
}

/**
 * Get current router state for debugging
 */
export function getProviderStates(): AIRouterState {
    return routerState;
}

/**
 * Get user-friendly status message
 */
export function getStatusMessage(): string {
    if (isOpenRouterAvailable()) {
        return 'Using OpenRouter (cloud AI)';
    }
    if (routerState.ollama.available) {
        return 'Using local Ollama';
    }
    return 'AI services unavailable';
}

/**
 * Get AI status for debug endpoint
 */
export async function getAIStatus(): Promise<{
    active_provider: string | null;
    openrouter: {
        status: string;
        primary_model: string;
        fallback_model: string;
        calls_today: number;
        max_calls: number;
    };
    ollama: {
        status: string;
    };
    last_success: string | null;
    last_error: string | null;
}> {
    await initialize();
    const ollamaHealth = await checkOllama();

    return {
        active_provider: routerState.lastSuccessfulProvider,
        openrouter: {
            status: routerState.openRouter.health,
            primary_model: OPENROUTER_PRIMARY_MODEL,
            fallback_model: OPENROUTER_FALLBACK_MODEL,
            calls_today: routerState.openRouter.callsToday,
            max_calls: routerState.openRouter.maxCallsPerDay
        },
        ollama: {
            status: ollamaHealth.available ? 'available' : 'unavailable'
        },
        last_success: routerState.lastSuccessfulProvider,
        last_error: routerState.lastError
    };
}

/**
 * Reset router state (for testing)
 */
export function resetProviderStates(): void {
    initialized = false;
    routerState.openRouter.health = 'healthy';
    routerState.openRouter.callsToday = 0;
    routerState.ollama.available = false;
    routerState.ollama.lastCheck = 0;
    routerState.activeProvider = null;
    routerState.lastSuccessfulProvider = null;
    routerState.lastError = null;
}
