/**
 * User Init API
 * POST - Initialize user on first sign-in, auto-generate username if needed
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { ensureUserWithUsername, getUserProfile } from '@/lib/db';
import { generateUsername } from '@/lib/username';

export async function POST() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if user already has a username
        const existingProfile = await getUserProfile(userId);

        if (existingProfile?.username) {
            // Already initialized
            return NextResponse.json({
                username: existingProfile.username,
                isNew: false
            });
        }

        // Generate and save a unique username
        const username = await ensureUserWithUsername(userId, generateUsername);

        return NextResponse.json({
            username: username,
            isNew: true
        });
    } catch (error) {
        console.error('Error initializing user:', error);
        return NextResponse.json({ error: 'Failed to initialize user' }, { status: 500 });
    }
}
