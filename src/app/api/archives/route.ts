// API Route: GET /api/archives
// Get archived jobs

import { NextRequest, NextResponse } from 'next/server';
import { getJobs } from '@/lib/db';

import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 500;

        const jobs = await getJobs(userId, 'archived', Math.min(limit, 500));

        return NextResponse.json({
            jobs,
            count: jobs.length,
        });
    } catch (error) {
        console.error('Error fetching archives:', error);
        return NextResponse.json(
            { error: 'Failed to fetch archives' },
            { status: 500 }
        );
    }
}
