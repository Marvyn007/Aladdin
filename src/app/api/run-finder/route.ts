import { NextRequest, NextResponse } from 'next/server';
import { JobSourceCoordinator } from '@/lib/job-sources';
import { insertJob } from '@/lib/db';
import { Job } from '@/types';
import { v4 as uuidv4 } from 'uuid';

// Allow running this every 5 minutes if needed, but cron will handle scheduling
export const maxDuration = 300; // 5 minutes max duration for Vercel Pro (functions)

export async function POST(request: NextRequest) {
    try {
        // Optional: Secure this endpoint with a secret if exposed publicly
        // const authHeader = request.headers.get('authorization');
        // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const coordinator = new JobSourceCoordinator();

        // Strict Filters: Intern/Entry, 24h freshness, US only
        console.log('Running Broad Search (All Levels, All Time)...');
        const jobs = await coordinator.fetchAllJobs({
            recent: false,
            location: 'us',
            keywords: ['software engineer', 'developer', 'full stack', 'frontend', 'backend', 'web developer'],
            level: []
        });

        // Current time for consistency
        const now = new Date();
        let addedCount = 0;

        // Process jobs in chunks to speed up insertion while managing connection pool
        const CHUNK_SIZE = 10;
        for (let i = 0; i < jobs.length; i += CHUNK_SIZE) {
            const chunk = jobs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (scrapedJob) => {
                // Generate ID here to satisfy Job interface
                const jobId = uuidv4();

                // Convert ScrapedJob to DB Job
                const jobData: any = { // Use any intermediate to avoid strict type checks
                    id: jobId,
                    title: scrapedJob.title,
                    company: scrapedJob.company || 'Unknown',
                    location: scrapedJob.location || 'Remote',
                    source_url: scrapedJob.source_url,
                    posted_at: scrapedJob.posted_at || null,
                    fetched_at: now.toISOString(),
                    status: 'fresh',
                    match_score: 0,
                    matched_skills: [],
                    missing_skills: [],
                    why: null,
                    normalized_text: scrapedJob.description
                        ? scrapedJob.description.replace(/<[^>]*>?/gm, '') // Strip HTML
                        : scrapedJob.title,
                    raw_text_summary: scrapedJob.description ? scrapedJob.description.substring(0, 1000) : null,
                    content_hash: null
                };

                const cleanJob: Job = {
                    id: jobData.id,
                    title: jobData.title,
                    company: jobData.company,
                    location: jobData.location,
                    source_url: jobData.source_url,
                    posted_at: jobData.posted_at,
                    fetched_at: jobData.fetched_at,
                    status: 'fresh',
                    match_score: 0,
                    matched_skills: null,
                    missing_skills: null,
                    why: null,
                    normalized_text: jobData.normalized_text,
                    raw_text_summary: jobData.raw_text_summary,
                    content_hash: null
                };

                try {
                    await insertJob(cleanJob);
                    addedCount++;
                } catch (e: any) {
                    // Ignore duplicates
                    if (!e.message.includes('unique constraint') && !e.message.includes('Duplicate job')) {
                        console.error(`Failed to insert job ${scrapedJob.title}:`, e);
                    }
                }
            }));

            // Log progress occasionally
            if ((i + CHUNK_SIZE) % 50 === 0) {
                console.log(`[Import] Processed ${i + CHUNK_SIZE}/${jobs.length} jobs...`);
            }
        }

        return NextResponse.json({
            success: true,
            jobsFound: jobs.length,
            jobsAdded: addedCount
        });

    } catch (error: any) {
        console.error('Finder run failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
