/**
 * API Route: GET /api/ai-status
 * Returns the current status of all AI providers
 */

import { NextResponse } from 'next/server';
import { getProviderStates, isAIAvailable, getStatusMessage } from '@/lib/ai-router';

export async function GET() {
    try {
        const states = getProviderStates();
        const available = isAIAvailable();
        const message = getStatusMessage();

        // Format provider states for the response
        const providers = {
            openRouter: {
                id: 'openRouter',
                name: states.openRouter.name,
                health: states.openRouter.health,
                lastError: states.openRouter.lastError,
                callsToday: states.openRouter.callsToday,
                maxCallsPerDay: states.openRouter.maxCallsPerDay,
            },
            ollama: {
                id: 'ollama',
                name: 'Ollama',
                available: states.ollama.available,
                lastCheck: states.ollama.lastCheck,
            },
        };

        return NextResponse.json({
            available,
            message,
            providers,
            activeProvider: states.activeProvider,
            lastSuccessfulProvider: states.lastSuccessfulProvider,
        });
    } catch (error) {
        console.error('Error getting AI status:', error);
        return NextResponse.json(
            { error: 'Failed to get AI status', available: false },
            { status: 500 }
        );
    }
}
