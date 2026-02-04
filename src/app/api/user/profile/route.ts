/**
 * User Profile API
 * GET - Fetch user profile including custom username
 * PUT - Update username
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserProfile, setUsername, checkUsernameExists } from '@/lib/db';
import { validateUsername } from '@/lib/username';

export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const profile = await getUserProfile(userId);

        return NextResponse.json({
            exists: !!profile,
            user_id: userId,
            username: profile?.username || null,
            created_at: profile?.created_at || null,
            updated_at: profile?.updated_at || null
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { username } = body;

        // Validate username format
        const validation = validateUsername(username);
        if (!validation.valid) {
            return NextResponse.json({
                error: validation.error,
                field: 'username'
            }, { status: 400 });
        }

        // Check availability (if not clearing)
        if (username?.trim()) {
            const exists = await checkUsernameExists(username.trim(), userId);
            if (exists) {
                return NextResponse.json({
                    error: 'This username is already taken. Please choose another.',
                    field: 'username'
                }, { status: 409 });
            }
        }

        // Save username
        const result = await setUsername(userId, username?.trim() || null);

        if (!result.success) {
            return NextResponse.json({
                error: result.error || 'Failed to update username',
                field: 'username'
            }, { status: 400 });
        }

        // Fetch updated profile
        const profile = await getUserProfile(userId);

        return NextResponse.json({
            success: true,
            username: profile?.username || null
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        return NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
    }
}
