/**
 * Ollama Test Endpoint
 * GET /api/debug/test-ollama
 * 
 * Tests local Ollama availability with a tiny generation
 */

import { NextResponse } from 'next/server';
import { checkOllama, getOllamaConfig } from '@/lib/adapters/ollama';

export const dynamic = 'force-dynamic';
export const maxDuration = 15;

export async function GET() {
    const start = Date.now();

    try {
        // Run health check
        const result = await checkOllama();
        const config = getOllamaConfig();

        return NextResponse.json({
            status: result.available ? 'OK' : 'UNAVAILABLE',
            available: result.available,
            model_used: result.model_used,
            latency_ms: result.latency_ms,
            errors: result.errors,
            note: result.note || null,
            config: {
                base_url: config.baseUrl,
                primary_model: config.primaryModel,
                fallback_model: config.fallbackModel
            },
            total_time_ms: Date.now() - start
        });
    } catch (error: any) {
        // This should never happen since checkOllama doesn't throw
        return NextResponse.json({
            status: 'ERROR',
            available: false,
            model_used: null,
            latency_ms: null,
            errors: [error.message],
            total_time_ms: Date.now() - start
        }, { status: 500 });
    }
}
