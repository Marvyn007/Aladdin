import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { validateUsername } from '@/lib/username';
import { checkUsernameExists } from '@/lib/db';

/**
 * POST /api/user/username/validate
 * Validate a candidate username without saving
 * Returns validation errors if any
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { username } = body;

        // Format validation
        const formatValidation = validateUsername(username);
        if (!formatValidation.valid) {
            return NextResponse.json({
                valid: false,
                error: formatValidation.error,
                errorCode: 'FORMAT_ERROR'
            });
        }

        // Empty username is valid (allows clearing)
        if (!username || username.trim().length === 0) {
            return NextResponse.json({
                valid: true,
                message: 'Username can be cleared'
            });
        }

        // Check uniqueness (case-insensitive)
        const exists = await checkUsernameExists(username, userId);
        if (exists) {
            return NextResponse.json({
                valid: false,
                error: 'That username is already taken.',
                errorCode: 'DUPLICATE'
            });
        }

        return NextResponse.json({
            valid: true,
            message: 'Username is available'
        });

    } catch (error: any) {
        console.error('[Username Validate] Error:', error);
        return NextResponse.json(
            { error: 'Validation failed' },
            { status: 500 }
        );
    }
}
