// API Route: POST /api/run-ai-cleanup
// Run AI filtering on fresh jobs to delete those matching strict criteria

import { NextResponse } from 'next/server';
import { getJobs, deleteJob } from '@/lib/db';
import { batchFilterJobs } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes max

export async function POST() {
    try {
        console.log('Starting AI Cleanup...');

        // 1. Fetch fresh jobs
        // Get up to 100 fresh jobs to analyze
        const limit = 100;
        const jobs = await getJobs('fresh', limit);

        if (jobs.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No fresh jobs to analyze',
                stats: { analyzed: 0, deleted: 0 }
            });
        }

        console.log(`Analyzing ${jobs.length} jobs...`);

        // 2. Process in batches of 20 to avoid token limits
        const batchSize = 25;
        const allDeleteIds: string[] = [];
        const allReasons: Record<string, string> = {};

        for (let i = 0; i < jobs.length; i += batchSize) {
            // Add delay to respect rate limits (especially free tier)
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            const batch = jobs.slice(i, i + batchSize);
            const { deleteIds, reasons } = await batchFilterJobs(batch);

            allDeleteIds.push(...deleteIds);
            Object.assign(allReasons, reasons);

            console.log(`Batch ${Math.floor(i / batchSize) + 1}: Flagged ${deleteIds.length} jobs for deletion`);
        }

        // 3. Delete flagged jobs
        let deletedCount = 0;
        for (const id of allDeleteIds) {
            try {
                await deleteJob(id);
                deletedCount++;
                const jobTitle = jobs.find(j => j.id === id)?.title || 'Unknown';
                console.log(`Deleted job ${id} (${jobTitle}): ${allReasons[id]}`);
            } catch (err) {
                console.error(`Failed to delete job ${id}:`, err);
            }
        }

        return NextResponse.json({
            success: true,
            stats: {
                analyzed: jobs.length,
                deleted: deletedCount,
                reasons: allReasons
            }
        });

    } catch (error) {
        console.error('Error running AI cleanup:', error);

        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const isAIError = errorMessage.includes('AI services temporarily unavailable');

        return NextResponse.json({
            error: isAIError
                ? 'AI services temporarily unavailable. Please try again later.'
                : errorMessage,
            aiUnavailable: isAIError
        }, { status: isAIError ? 503 : 500 });
    }
}
