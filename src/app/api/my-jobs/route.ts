import { NextRequest, NextResponse } from 'next/server';
import { getJobs, getTotalUserJobsCount, getLastJobIngestionTime } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '50', 10);
        const sortBy = (searchParams.get('sort_by') || 'time') as 'time' | 'imported' | 'score' | 'relevance';
        const sortDir = (searchParams.get('sort_dir') || 'desc') as 'asc' | 'desc';
        // 'my-jobs' endpoint handles user-specific job lists: 'fresh', 'saved', 'archived'
        const status = (searchParams.get('status') || 'saved') as 'fresh' | 'saved' | 'archived';

        const [jobs, total, lastUpdated] = await Promise.all([
            getJobs(userId, status, page, limit, sortBy, sortDir),
            getTotalUserJobsCount(userId, status),
            getLastJobIngestionTime()
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            jobs,
            total,
            totalPages,
            lastUpdated
        });

    } catch (error) {
        console.error('Error fetching my jobs:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
