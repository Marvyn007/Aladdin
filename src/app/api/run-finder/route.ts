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
        console.log('Running Strict Search (Intern/Entry, <24h)...');
        const jobs = await coordinator.fetchAllJobs({
            recent: true,
            location: 'us',
            keywords: ['software engineer', 'developer', 'full stack', 'frontend', 'backend', 'web developer'],
            level: ['intern', 'internship', 'entry level', 'new grad', 'junior']
        });

        // Current time for consistency
        const now = new Date();
        let addedCount = 0;

        for (const scrapedJob of jobs) {
            // Generate ID here to satisfy Job interface
            const jobId = uuidv4();

            // Convert ScrapedJob to DB Job
            const jobData: any = { // Use any intermediate to avoid strict type checks on extra props if strictly typed
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
                // Map description to normalized_text (stripped) and raw_text_summary
                normalized_text: scrapedJob.description
                    ? scrapedJob.description.replace(/<[^>]*>?/gm, '') // Strip HTML
                    : scrapedJob.title,
                raw_text_summary: scrapedJob.description ? scrapedJob.description.substring(0, 1000) : null,
                content_hash: null // handled by DB logic usually, but required in interface
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
                matched_skills: null, // Type allows null
                missing_skills: null, // Type allows null
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
