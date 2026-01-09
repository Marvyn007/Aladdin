/**
 * API Route: POST /api/ai-reset
 * Reset AI provider states to recover from stuck "unavailable" states
 */

import { NextResponse } from 'next/server';
import { resetProviderStates, getProviderStates, isAIAvailable, getStatusMessage } from '@/lib/ai-router';

export async function POST() {
    try {
        console.log('[AI Reset] Resetting all provider states...');

        // Reset all providers
        resetProviderStates();

        // Get new states
        const states = getProviderStates();
        const available = isAIAvailable();
        const message = getStatusMessage();

        console.log('[AI Reset] Reset complete. Status:', message);

        return NextResponse.json({
            success: true,
            message: 'AI provider states reset successfully',
            available,
            statusMessage: message,
            providers: {
                openRouter: {
                    name: states.openRouter.name,
                    health: states.openRouter.health,
                },
                ollama: {
                    available: states.ollama.available,
                },
            },
            activeProvider: states.activeProvider,
        });
    } catch (error) {
        console.error('Error resetting AI states:', error);
        return NextResponse.json(
            { error: 'Failed to reset AI states' },
            { status: 500 }
        );
    }
}
