/**
 * AI Status Debug Endpoint
 * GET /api/debug/ai-status
 * 
 * Shows current AI provider status for debugging
 */

import { NextResponse } from 'next/server';
import { getAIStatus, getStatusMessage } from '@/lib/ai-router';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const status = await getAIStatus();

        return NextResponse.json({
            timestamp: new Date().toISOString(),
            summary: getStatusMessage(),
            architecture: 'OPENROUTER_FIRST (OpenRouter → Ollama)',
            active_provider: status.active_provider,
            providers: {
                openrouter: {
                    status: status.openrouter.status,
                    primary_model: status.openrouter.primary_model,
                    fallback_model: status.openrouter.fallback_model,
                    calls_today: status.openrouter.calls_today,
                    max_calls_per_day: status.openrouter.max_calls
                },
                ollama: {
                    status: status.ollama.status
                }
            },
            last_success: status.last_success,
            last_error: status.last_error
        });
    } catch (error: any) {
        return NextResponse.json({
            error: error.message,
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
