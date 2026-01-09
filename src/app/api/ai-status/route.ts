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
        const providers = Object.entries(states.providers).map(([key, provider]) => ({
            id: key,
            name: provider.name,
            health: provider.health,
            available: provider.health !== 'unavailable' &&
                (!provider.unavailableUntil || Date.now() >= provider.unavailableUntil),
            unavailableUntil: provider.unavailableUntil
                ? new Date(provider.unavailableUntil).toISOString()
                : null,
            lastError: provider.lastError,
            consecutiveFailures: provider.consecutiveFailures,
        }));

        return NextResponse.json({
            available,
            message,
            providers,
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
