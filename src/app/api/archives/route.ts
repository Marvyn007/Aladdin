// API Route: GET /api/archives
// Get archived jobs

import { NextRequest, NextResponse } from 'next/server';
import { getJobs } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');
        const limit = limitParam ? parseInt(limitParam, 10) : 500;

        const jobs = await getJobs('archived', Math.min(limit, 500));

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
