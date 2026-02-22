
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { routeAICall, resetProviderStates, getProviderStates } from '../src/lib/ai-router';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as HFAdapter from '../src/lib/adapters/huggingface';
import * as RepAdapter from '../src/lib/adapters/replicate';
import * as DB from '../src/lib/db';

// Mock dependencies
vi.mock('@google/generative-ai');
vi.mock('../src/lib/adapters/huggingface');
vi.mock('../src/lib/adapters/replicate');
vi.mock('../src/lib/db');

// Mock fetch for OpenRouter
global.fetch = vi.fn();

describe.skip('AI Router - 5 Tier & Safety', () => {
    beforeEach(() => {
        vi.resetAllMocks();
        process.env.GEMINI_API_KEY_A = 'key-a';
        process.env.GEMINI_API_KEY_B = 'key-b';
        process.env.OPENROUTER_API_KEY = 'key-or';
        process.env.HUGGINGFACE_API_KEY = 'key-hf';
        process.env.REPLICATE_API_TOKEN = 'key-rep';

        // Default DB Mocks
        // @ts-ignore
        DB.getProviderStats.mockResolvedValue(null); // No stored state initially
        // @ts-ignore
        DB.updateProviderStats.mockResolvedValue(undefined);

        resetProviderStates();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should use Gemini A if healthy', async () => {
        const mockGenerate = vi.fn().mockResolvedValue({
            response: { text: () => 'Gemini A Result' }
        });
        // @ts-ignore
        GoogleGenerativeAI.mockImplementation(function () {
            return { getGenerativeModel: () => ({ generateContent: mockGenerate }) };
        });

        // Trigger init within test
        resetProviderStates();

        const res = await routeAICall('prompt');
        expect(res).toBe('Gemini A Result');
        expect(mockGenerate).toHaveBeenCalled();
        expect(getProviderStates().lastSuccessfulProvider).toBe('geminiA');
    });

    it('should fallback to HuggingFace if Geminis/OR fail', async () => {
        // Mock Gemini Fails (429)
        // @ts-ignore
        GoogleGenerativeAI.mockImplementation(function () {
            return {
                getGenerativeModel: () => ({
                    generateContent: vi.fn().mockRejectedValue(new Error('429 Too Many Requests'))
                })
            };
        });

        // Mock OpenRouter Fail (429)
        // @ts-ignore
        global.fetch.mockResolvedValue({
            ok: false,
            status: 429,
            text: async () => 'Rate Limit'
        });

        // Mock HF Success
        // @ts-ignore
        HFAdapter.callHuggingFace.mockResolvedValue('HF Result');

        resetProviderStates();

        const res = await routeAICall('prompt');
        expect(res).toBe('HF Result');
        expect(HFAdapter.callHuggingFace).toHaveBeenCalled();
        expect(getProviderStates().lastSuccessfulProvider).toBe('huggingFace');
    });

    it('should fallback to Replicate if all others fail', async () => {
        // Mock All previous fail
        // @ts-ignore
        GoogleGenerativeAI.mockImplementation(function () {
            return {
                getGenerativeModel: () => ({
                    generateContent: vi.fn().mockRejectedValue(new Error('429'))
                })
            };
        });
        // @ts-ignore
        global.fetch.mockResolvedValue({ ok: false, status: 429, text: async () => 'Rate Limit' }); // OR
        // @ts-ignore
        HFAdapter.callHuggingFace.mockRejectedValue(new Error('429 Rate Limit'));

        // Mock Replicate Success
        // @ts-ignore
        RepAdapter.callReplicate.mockResolvedValue('Replicate Result');

        resetProviderStates();

        const res = await routeAICall('prompt');
        expect(res).toBe('Replicate Result');
        expect(RepAdapter.callReplicate).toHaveBeenCalled();
    });

    it('should hard disable HF on free tier exhaustion', async () => {
        // Setup: Gemini/OR unavailable to force falling to HF
        process.env.GEMINI_API_KEY_A = '';
        process.env.GEMINI_API_KEY_B = '';
        process.env.OPENROUTER_API_KEY = '';

        // Mock HF fail with rate limit (implies exhaustion for free tier providers)
        // @ts-ignore
        HFAdapter.callHuggingFace.mockRejectedValue(new Error('429 Too Many Requests'));

        // Mock Replicate Success
        // @ts-ignore
        RepAdapter.callReplicate.mockResolvedValue('Rep Result');

        resetProviderStates();

        // 1. First call fails HF -> Replicate Succeeded
        // Should NOT throw, but should disable HF
        const res = await routeAICall('prompt');
        expect(res).toBe('Rep Result');

        const state = getProviderStates() as any;
        expect(state.providers.huggingFace.health).toBe('disabled_free_tier_exhausted');
        expect(DB.updateProviderStats).toHaveBeenCalledWith('huggingface', expect.objectContaining({
            status: 'disabled_free_tier_exhausted'
        }));

        // 2. Second call should NOT try HF (mock verify)
        vi.clearAllMocks();
        // @ts-ignore
        RepAdapter.callReplicate.mockResolvedValue('Rep Result');

        // We expect it to skip HF and go to Replicate
        await routeAICall('prompt');
        expect(HFAdapter.callHuggingFace).not.toHaveBeenCalled();
        expect(RepAdapter.callReplicate).toHaveBeenCalled();
    });

    it('should respect Daily Limits from DB', async () => {
        // Mock DB returning limit reached for HF
        // @ts-ignore
        DB.getProviderStats.mockImplementation((key) => {
            if (key === 'huggingface') return {
                status: 'healthy',
                calls_today: 100, // > 20 limit
                last_reset: new Date().toISOString().split('T')[0]
            };
            return null;
        });

        // Setup: Gemini/OR unavailable
        process.env.GEMINI_API_KEY_A = '';
        process.env.GEMINI_API_KEY_B = '';
        process.env.OPENROUTER_API_KEY = '';

        // Expect to skip HF and try Replicate
        // @ts-ignore
        RepAdapter.callReplicate.mockResolvedValue('Rep Result');

        resetProviderStates();

        const res = await routeAICall('prompt');
        expect(res).toBe('Rep Result');
        expect(HFAdapter.callHuggingFace).not.toHaveBeenCalled();
    });
});
