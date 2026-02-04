/**
 * Authentication helper for API routes
 * Provides userId extraction and validation using Clerk
 */

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

/**
 * Get the authenticated user's ID
 * Throws an error if not authenticated
 */
export async function getAuthenticatedUserId(): Promise<string> {
    const { userId } = await auth();

    if (!userId) {
        throw new Error('Unauthorized: No user ID found');
    }

    return userId;
}

/**
 * Wrapper for API handlers that require authentication
 * Returns 401 if not authenticated, otherwise passes userId to handler
 */
export function withAuth<T>(
    handler: (userId: string, request: Request) => Promise<T>
) {
    return async (request: Request): Promise<NextResponse | T> => {
        try {
            const userId = await getAuthenticatedUserId();
            return handler(userId, request);
        } catch {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }
    };
}

/**
 * Check if request is authenticated without throwing
 */
export async function isAuthenticated(): Promise<boolean> {
    try {
        const { userId } = await auth();
        return !!userId;
    } catch {
        return false;
    }
}

/**
 * Get userId or null if not authenticated
 */
export async function getUserIdOrNull(): Promise<string | null> {
    try {
        const { userId } = await auth();
        return userId;
    } catch {
        return null;
    }
}
