import { NextRequest, NextResponse } from 'next/server';
import { JobSourceCoordinator } from '@/lib/job-sources';
import { insertJob } from '@/lib/db';
import { Job } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Allow running this every 5 minutes if needed, but cron will handle scheduling
export const maxDuration = 300; // 5 minutes max duration for Vercel Pro (functions)

import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Optional: Secure this endpoint with a secret if exposed publicly
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const coordinator = new JobSourceCoordinator();

        // UNFILTERED FETCH: Get ALL jobs without whitelist/location/date filters
        console.log('Running UNFILTERED Job Fetch (ALL Jobs)...');
        const jobs = await coordinator.fetchAllJobsUnfiltered({
            recent: false,
            location: 'us',
            keywords: ['software engineer', 'developer', 'full stack', 'frontend', 'backend', 'web developer'],
            level: []
        });

        console.log(`[Import] Fetched ${jobs.length} total jobs for persistence`);

        // Current time for consistency
        const now = new Date();
        let addedCount = 0;
        let failedCount = 0;
        const failedJobs: { title: string; error: string }[] = [];

        // Process jobs in chunks to speed up insertion while managing connection pool
        const CHUNK_SIZE = 10;
        for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
            const chunk = jobs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (scrapedJob) => {
                // Generate ID here to satisfy Job interface
                const jobId = uuidv4();

                // Convert ScrapedJob to DB Job
                const cleanJob: Job = {
                    id: jobId,
                    title: scrapedJob.title,
                    company: scrapedJob.company || 'Unknown',
                    location: scrapedJob.location || 'Remote',
                    source_url: scrapedJob.source_url,
                    posted_at: scrapedJob.posted_at || null,
                    fetched_at: now.toISOString(),
                    status: 'fresh',
                    match_score: 0,
                    matched_skills: null,
                    missing_skills: null,
                    why: null,
                    normalized_text: scrapedJob.description
                        ? scrapedJob.description.replace(/<[^>]*>?/gm, '') // Strip HTML
                        : scrapedJob.title,
                    raw_text_summary: scrapedJob.description ? scrapedJob.description.substring(0, 1000) : null,
                    content_hash: null
                };

                try {
                    await insertJob(userId, cleanJob);
                    addedCount++;
                } catch (e: any) {
                    // ERROR TOLERANT: Log failure but continue with other jobs
                    const errorMsg = e.message || 'Unknown error';
                    if (!errorMsg.includes('unique constraint') && !errorMsg.includes('Duplicate job')) {
                        console.error(`[Import] Failed to insert job "${scrapedJob.title}":`, errorMsg);
                        failedCount++;
                        if (failedJobs.length < 10) { // Only track first 10 failures for response
                            failedJobs.push({ title: scrapedJob.title, error: errorMsg });
                        }
                    }
                    // Duplicates are expected and not counted as failures
                }
            }));

            // Log progress occasionally
            if ((i + CHUNK_SIZE) % 100 === 0 || i + CHUNK_SIZE >= jobs.length) {
                console.log(`[Import] Processed ${Math.min(i + CHUNK_SIZE, jobs.length)}/${jobs.length} jobs...`);
            }
        }

        console.log(`[Import] Complete: ${addedCount} added, ${failedCount} failed`);

        return NextResponse.json({
            success: true,
            jobsFound: jobs.length,
            jobsAdded: addedCount,
            jobsFailed: failedCount,
            failedSamples: failedJobs.length > 0 ? failedJobs : undefined
        });

    } catch (error: any) {
        console.error('Finder run failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
