import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { updateSettings } from '@/lib/db';

const MAX_FILTERS = 20;

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        let filters = body.filters;

        if (!Array.isArray(filters)) {
            return NextResponse.json({ error: 'Invalid filters format' }, { status: 400 });
        }

        filters = filters
            .map((f: string) => String(f).trim().toLowerCase())
            .filter((f: string) => f.length > 0)
            .slice(0, MAX_FILTERS);

        await updateSettings(userId, {
            excludedKeywords: filters
        });

        return NextResponse.json({
            success: true,
            filters,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Preferences Filters API] Error saving filters:', error);
        return NextResponse.json(
            { error: 'Failed to save filters' },
            { status: 500 }
        );
    }
}
