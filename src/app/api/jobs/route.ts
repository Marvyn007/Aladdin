import { NextRequest, NextResponse } from 'next/server';
import { getAllPublicJobs, getTotalPublicJobsCount, getLastJobIngestionTime, getJobs, getJobCount } from '@/lib/db';
import { auth } from '@clerk/nextjs/server';
import { getOnboardingSnapshot } from '@/lib/onboarding-db';
import { computePreferenceScore } from '@/lib/preference-scoring';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        const searchParams = request.nextUrl.searchParams;
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '25', 10);
        const sortByRaw = (searchParams.get('sort_by') || 'time') as 'time' | 'imported' | 'score' | 'preferences';
        const sortDir = (searchParams.get('sort_dir') || 'desc') as 'asc' | 'desc';
        const statusParam = searchParams.get('status');

        // Normalize sortBy for DB calls — 'preferences' and 'score' use time sort at DB level
        // The API layer re-sorts by preference score after fetching (see below)
        const dbSortBy: 'time' | 'imported' = (sortByRaw === 'imported') ? 'imported' : 'time';
        const sortBy = sortByRaw;

        let jobs, total, lastUpdated;

        // If authenticated and filtering by specific status (saved, applied, etc), use getJobs
        // 'fresh' is treated as default/all public stream for now, but annotating with user status
        if (userId && statusParam && statusParam !== 'fresh' && statusParam !== 'all') {
            [jobs, total, lastUpdated] = await Promise.all([
                getJobs(userId, statusParam as any, page, limit, dbSortBy, sortDir),
                getJobCount(userId, statusParam as any),
                getLastJobIngestionTime()
            ]);
        } else {
            // Default: Public stream (annotated with user status if logged in)
            [jobs, total, lastUpdated] = await Promise.all([
                getAllPublicJobs(page, limit, sortByRaw === 'preferences' ? 'preferences' : dbSortBy, sortDir, userId || null),
                getTotalPublicJobsCount(),
                getLastJobIngestionTime()
            ]);
        }

        // Preference-based re-sort (per D-04, D-05, D-07)
        // DB always returns jobs in time order; we re-sort in memory when sortBy=preferences
        if (sortBy === 'preferences' && userId) {
            try {
                const snapshot = await getOnboardingSnapshot(userId);
                if (snapshot.completed && snapshot.answers.length > 0) {
                    jobs = jobs
                        .map((job: any) => ({ job, score: computePreferenceScore(job, snapshot.answersByKey) }))
                        .sort((a: any, b: any) => b.score - a.score)
                        .map(({ job }: { job: any }) => job);
                }
                // If not completed or no answers, jobs remain in default time order (soft degradation per D-05)
            } catch (err) {
                console.error('[Jobs API] Preference scoring failed, falling back to time sort:', err);
                // Graceful fallback: return jobs in default order
            }
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
