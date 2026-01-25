import { NextRequest, NextResponse } from 'next/server';
import { getAllPublicJobs, getTotalPublicJobsCount } from '@/lib/db';

export const dynamic = 'force-dynamic';

/**
 * GET /api/jobs - Paginated public jobs listing
 * 
 * Query params:
 *   - page: Page number (1-indexed, default: 1)
 *   - limit: Jobs per page (25, 50, or 100; default: 50)
 * 
 * Response:
 *   - jobs: Array of job objects
 *   - total: Total number of jobs in database
 *   - page: Current page number
 *   - limit: Jobs per page
 *   - totalPages: Total number of pages
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Parse pagination params
        const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
        const requestedLimit = parseInt(searchParams.get('limit') || '50', 10);

        // Validate limit to allowed values
        const allowedLimits = [25, 50, 100];
        const limit = allowedLimits.includes(requestedLimit) ? requestedLimit : 50;

        // Fetch jobs and total count in parallel
        const [jobs, total] = await Promise.all([
            getAllPublicJobs(page, limit),
            getTotalPublicJobsCount()
        ]);

        const totalPages = Math.ceil(total / limit);

        return NextResponse.json({
            jobs,
            total,
            page,
            limit,
            totalPages,
            hasNext: page < totalPages,
            hasPrev: page > 1
        });

    } catch (error: any) {
        console.error('[/api/jobs] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}
