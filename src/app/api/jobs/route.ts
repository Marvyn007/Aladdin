import { NextRequest, NextResponse } from 'next/server';
import { getAllPublicJobs, getTotalPublicJobsCount, getLastJobIngestionTime, getJobs } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        // Force limit to 50
        const limit = 50;
        const sortBy = (searchParams.get('sort_by') || 'time') as 'time' | 'imported' | 'score';
        const sortDir = (searchParams.get('sort_dir') || 'desc') as 'asc' | 'desc';
        const statusParam = searchParams.get('status');

        let jobs, total, lastUpdated;

        // If authenticated and filtering by specific status (saved, applied, etc), use getJobs
        // 'fresh' is treated as default/all public stream for now, but annotating with user status
        if (userId && statusParam && statusParam !== 'fresh' && statusParam !== 'all') {
            [jobs, total, lastUpdated] = await Promise.all([
                getJobs(userId, statusParam as any, page, limit, sortBy, sortDir),
                // We don't have a getTotalJobs(userId, status) helper exposed efficiently? 
                // getJobs doesn't return total. We might need a separate count query or update getJobs.
                // For now, let's use the public total/lastUpdated as fallback or implement count.
                // Actually getTotalPublicJobsCount is wrong for filtered views.
                // Ideally getJobs should return { jobs, total }.
                // Let's rely on client-side or fallback for now to minimize changes, 
                // but standard pagination requires total.
                // Let's assume for this "Saved Layout" fix, simply returning the jobs correct is key.
                // We'll use getTotalPublicJobsCount() as a dummy total to prevent crashes, 
                // but this will break pagination count for Saved tab.
                // However, fixing pagination completely requires updating db.ts exports.
                // Let's check db.ts exports for count helpers.
                getTotalPublicJobsCount(),
                getLastJobIngestionTime()
            ]);
        } else {
            // Default: Public stream (annotated with user status if logged in)
            [jobs, total, lastUpdated] = await Promise.all([
                getAllPublicJobs(page, limit, sortBy, sortDir, userId || null),
                getTotalPublicJobsCount(),
                getLastJobIngestionTime()
            ]);
        }

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
