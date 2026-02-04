import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateUsername } from '@/lib/username';
import { setUsername, checkUsernameExists } from '@/lib/db';

/**
 * PUT /api/user/username
 * Save username for the authenticated user
 * Performs all validations and handles race conditions
 */
export async function PUT(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { username } = body;

        // Handle clearing username (set to null)
        if (!username || username.trim().length === 0) {
            try {
                await setUsername(userId, null);
                console.log(`[Username] Cleared username for user ${userId}`);
                return NextResponse.json({
                    success: true,
                    message: 'Username cleared',
                    username: null
                });
            } catch (error: any) {
                console.error('[Username] Failed to clear:', error);
                return NextResponse.json(
                    { error: 'Failed to clear username' },
                    { status: 500 }
                );
            }
        }

        const trimmedUsername = username.trim();

        // Format validation
        const formatValidation = validateUsername(trimmedUsername);
        if (!formatValidation.valid) {
            return NextResponse.json({
                success: false,
                error: formatValidation.error,
                errorCode: 'FORMAT_ERROR'
            }, { status: 400 });
        }

        // Check uniqueness (case-insensitive, excluding current user)
        const exists = await checkUsernameExists(trimmedUsername, userId);
        if (exists) {
            return NextResponse.json({
                success: false,
                error: 'That username is already taken.',
                errorCode: 'DUPLICATE'
            }, { status: 409 });
        }

        // Attempt to save (with race condition handling)
        try {
            await setUsername(userId, trimmedUsername);
            console.log(`[Username] Saved username "${trimmedUsername}" for user ${userId}`);

            return NextResponse.json({
                success: true,
                message: 'Username saved',
                username: trimmedUsername
            });
        } catch (error: any) {
            // Handle unique constraint violation (race condition)
            if (error.message?.includes('UNIQUE') || error.code === '23505') {
                console.warn(`[Username] Race condition: "${trimmedUsername}" was taken`);
                return NextResponse.json({
                    success: false,
                    error: 'That username was just taken. Please try another.',
                    errorCode: 'RACE_CONDITION'
                }, { status: 409 });
            }
            throw error;
        }

    } catch (error: any) {
        console.error('[Username Save] Error:', error);
        return NextResponse.json(
            { error: 'Failed to save username' },
            { status: 500 }
        );
    }
}
