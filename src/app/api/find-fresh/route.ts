// API Route: GET /api/find-fresh
// Get fresh jobs - NO automatic AI scoring to avoid rate limits

import { NextRequest, NextResponse } from 'next/server';
import { getJobs, getSettings, updateLastUpdated } from '@/lib/db';
import type { Job } from '@/types';

export async function GET(request: NextRequest) {
    try {
        const searchParams = request.nextUrl.searchParams;
        const limitParam = searchParams.get('limit');

        // Get settings for default limit
        const settings = await getSettings();
        const limit = limitParam ? parseInt(limitParam, 10) : settings.freshLimit;

        // Clamp limit between 100 and 500
        const clampedLimit = Math.min(Math.max(limit, 100), 500);

        // Get fresh jobs (NO AI scoring - too expensive on free tier)
        const jobs = await getJobs('fresh', clampedLimit);

        // Update timestamp
        await updateLastUpdated();

        // Sort by match score descending (pre-existing scores only)
        jobs.sort((a: Job, b: Job) => (b.match_score || 0) - (a.match_score || 0));

        return NextResponse.json({
            jobs,
            count: jobs.length,
            limit: clampedLimit,
            lastUpdated: settings.lastUpdated,
        });
    } catch (error) {
        console.error('Error fetching fresh jobs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch fresh jobs' },
            { status: 500 }
        );
    }
}
