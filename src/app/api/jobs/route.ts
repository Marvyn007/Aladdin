import { NextRequest, NextResponse } from 'next/server';
import { getAllPublicJobs, getTotalPublicJobsCount, getLastJobIngestionTime } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        // Force limit to 50
        const limit = 50;
        const sortBy = (searchParams.get('sort_by') || 'time') as 'time' | 'imported' | 'score';
        const sortDir = (searchParams.get('sort_dir') || 'desc') as 'asc' | 'desc';

        const [jobs, total, lastUpdated] = await Promise.all([
            getAllPublicJobs(page, limit, sortBy, sortDir),
            getTotalPublicJobsCount(),
            getLastJobIngestionTime()
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            jobs,
            pagination: {
                page,
                limit,
                total,
                totalPages
            },
            total,
            totalPages,
            lastUpdated
        });
    } catch (error) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}
