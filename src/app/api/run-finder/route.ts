import { NextResponse } from 'next/server';
import { insertJob } from '@/lib/db';
import { Job } from '@/types';
import { v4 as uuidv4 } from 'uuid';
import { AdzunaAdapter } from '@/lib/job-sources/adzuna';
import { validateJobDescription } from '@/lib/job-validation';

export const maxDuration = 300; // 5 minutes max duration for Vercel Pro

import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST() {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        console.log('[Finder] Adzuna-only job fetch started...');

        const adzunaAdapter = new AdzunaAdapter();

        if (!adzunaAdapter.isEnabled()) {
            console.log('[Finder] Adzuna API keys not configured');
            return NextResponse.json({
                success: true,
                message: 'Adzuna API keys not configured. No jobs fetched.',
                jobsFound: 0,
                jobsAdded: 0,
                jobsFailed: 0,
                jobsSkipped: 0
            });
        }

        const user = await currentUser();
        const posterDetails = user ? {
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl
        } : undefined;

        // Fetch Adzuna jobs with unfiltered parameters

        // Fetch Adzuna jobs with unfiltered parameters
        console.log('[Finder] Fetching from Adzuna...');
        const rawJobs = await adzunaAdapter.fetchJobs({
            recent: false,
            location: 'us',
            keywords: ['software engineer', 'developer', 'full stack', 'frontend', 'backend', 'web developer'],
            level: []
        });

        console.log(`[Finder] Fetched ${rawJobs.length} raw jobs from Adzuna`);

        const now = new Date();
        let addedCount = 0;
        let failedCount = 0;
        let skippedCount = 0;
        const failedJobs: { title: string; error: string }[] = [];
        const skippedJobs: { title: string; reason: string; descriptionLength: number }[] = [];

        const CHUNK_SIZE = 10;
        for (let i = 0; i < rawJobs.length; i += CHUNK_SIZE) {
            const chunk = rawJobs.slice(i, i + CHUNK_SIZE);
            await Promise.all(chunk.map(async (rawJob) => {
                const jobId = uuidv4();

                // Clean and validate description
                const cleanDescription = rawJob.description
                    ? rawJob.description.replace(/<[^>]*>?/gm, '')
                    : rawJob.title;

                // Validate description quality (≥3000 chars)
                const descValidation = validateJobDescription(cleanDescription);

                if (!descValidation.valid) {
                    // Silently skip low-quality jobs
                    skippedCount++;
                    if (skippedJobs.length < 10) {
                        skippedJobs.push({
                            title: rawJob.title,
                            reason: descValidation.reason || 'Validation failed',
                            descriptionLength: cleanDescription.length
                        });
                    }
                    return;
                }

                const dbJob: Job = {
                    id: jobId,
                    title: rawJob.title,
                    company: rawJob.company || 'Unknown',
                    location: rawJob.location || 'Remote',
                    source_url: rawJob.source_url,
                    posted_at: rawJob.posted_at || null,
                    fetched_at: now.toISOString(),
                    status: 'fresh',
                    match_score: 0,
                    matched_skills: null,
                    missing_skills: null,
                    why: null,
                    normalized_text: cleanDescription,
                    raw_text_summary: cleanDescription.substring(0, 1000),
                    content_hash: null,
                    isImported: false,
                    original_posted_source: 'adzuna',
                    raw_description_html: rawJob.description,
                    job_description_plain: cleanDescription,
                    scraped_at: now.toISOString(),
                    extraction_confidence: { description: 1.0, date: 0.5, location: 0.4 }
                };

                try {
                    await insertJob(userId, dbJob, posterDetails);
                    addedCount++;
                } catch (e: unknown) {
                    const errorMsg = e instanceof Error ? e.message : 'Unknown error';

                    // Don't overwrite existing jobs (duplicate constraint)
                    if (errorMsg.includes('unique constraint') ||
                        errorMsg.includes('Duplicate job') ||
                        errorMsg.includes('already exists')) {
                        // Silently skip duplicates
                        return;
                    }

                    failedCount++;
                    if (failedJobs.length < 10) {
                        failedJobs.push({ title: rawJob.title, error: errorMsg });
                    }
                    console.error(`[Finder] Failed to insert Adzuna job "${rawJob.title}":`, errorMsg);
                }
            }));

            if ((i + CHUNK_SIZE) % 100 === 0 || i + CHUNK_SIZE >= rawJobs.length) {
                console.log(`[Finder] Processed ${Math.min(i + CHUNK_SIZE, rawJobs.length)}/${rawJobs.length} jobs...`);
            }
        }

        console.log(`[Finder] Adzuna fetch complete: ${addedCount} added, ${failedCount} failed, ${skippedCount} skipped`);

        // Sample description length from first successfully inserted job (if any)
        let sampleDescriptionLength: number | undefined;
        if (addedCount > 0) {
            const firstValidJob = rawJobs.find(j => {
                const cleanDesc = j.description?.replace(/<[^>]*>?/gm, '') || j.title;
                const validation = validateJobDescription(cleanDesc);
                return validation.valid;
            });
            if (firstValidJob) {
                sampleDescriptionLength = firstValidJob.description?.length;
            }
        }

        return NextResponse.json({
            success: true,
            message: addedCount > 0
                ? `Successfully fetched and inserted ${addedCount} Adzuna jobs.`
                : 'No high-quality jobs found from Adzuna. Try again later or use Import Job.',
            jobsFound: rawJobs.length,
            jobsAdded: addedCount,
            jobsFailed: failedCount,
            jobsSkipped: skippedCount,
            failedSamples: failedJobs.length > 0 ? failedJobs : undefined,
            skippedSamples: skippedJobs.length > 0 ? skippedJobs : undefined,
            sampleDescriptionLength
        });

    } catch (error: unknown) {
        console.error('Finder run failed:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
