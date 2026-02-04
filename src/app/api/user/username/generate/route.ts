import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateUsername } from '@/lib/username';

/**
 * POST /api/user/username/generate
 * Generate a candidate quirky username (no DB write)
 * Optionally accepts a seed for deterministic generation
 */
export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Generate a new quirky username
        const username = generateUsername();

        console.log(`[Username] Generated candidate: ${username} for user ${userId}`);

        return NextResponse.json({
            success: true,
            username
        });

    } catch (error: any) {
        console.error('[Username Generate] Error:', error);
        return NextResponse.json(
            { error: 'Failed to generate username' },
            { status: 500 }
        );
    }
}
