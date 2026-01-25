
import { NextRequest, NextResponse } from 'next/server';
import { getSettings, updateSettings } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await getSettings(userId);
        return NextResponse.json({ settings });
    } catch (error) {
        console.error('Error fetching settings:', error);
        return NextResponse.json(
            { error: 'Failed to fetch settings' },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { freshLimit } = await request.json();

        if (typeof freshLimit !== 'number') {
            return NextResponse.json({ error: 'Invalid limited' }, { status: 400 });
        }

        await updateSettings(userId, freshLimit);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error updating settings:', error);
        return NextResponse.json(
            { error: 'Failed to update settings' },
            { status: 500 }
        );
    }
}
