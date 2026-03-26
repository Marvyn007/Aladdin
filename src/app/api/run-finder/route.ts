import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

/**
 * @deprecated Legacy Adzuna finder. Replaced by the aggregation system
 * (POST /api/cron/tick + POST /api/worker). Kept as a stub to avoid 404.
 */
export async function POST() {
    const { userId } = await auth();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json({
        success: false,
        error: 'Legacy finder has been removed. Use the job aggregation system instead (POST /api/cron/tick).',
        jobsFound: 0,
        jobsAdded: 0,
        jobsFailed: 0,
        jobsSkipped: 0,
    }, { status: 410 }); // 410 Gone
}
