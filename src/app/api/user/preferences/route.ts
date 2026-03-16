import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getSettings } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const settings = await getSettings(userId);
        
        return NextResponse.json({
            filters: settings.excludedKeywords || [],
            updatedAt: settings.lastUpdated || null
        });
    } catch (error) {
        console.error('[Preferences API] Error fetching preferences:', error);
        return NextResponse.json(
            { error: 'Failed to fetch preferences' },
            { status: 500 }
        );
    }
}
