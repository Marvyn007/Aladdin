/**
 * API Route: POST /api/score-jobs
 * 
 * Production-grade Score Jobs pipeline
 * - LLM for extraction only (skills, industry, seniority)
 * - Deterministic for matching and scoring
 * - Confidence scoring and breakdown
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { runScoreJobsPipeline } from '@/lib/score-jobs';

// Force Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch scoring

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        let forceRescore = false;
        let jobIds: string[] | undefined;
        
        try {
            const body = await request.json();
            forceRescore = body.forceRescore ?? false;
            jobIds = body.jobIds;
        } catch {
            forceRescore = false;
            jobIds = undefined;
        }

        console.log(`[ScoreJobs] Starting pipeline for user ${userId}`);
        console.log(`[ScoreJobs] Force rescore: ${forceRescore}, Specific jobs: ${jobIds?.length || 'all'}`);

        // Run the pipeline
        const result = await runScoreJobsPipeline(userId, {
            forceRescore,
            jobIds,
            onProgress: ({ current, total, jobTitle }) => {
                console.log(`[ScoreJobs] Progress: ${current}/${total} - ${jobTitle}`);
            }
        });

        console.log(`[ScoreJobs] Pipeline complete. ${result.message}`);

        // Check if there were any jobs to score
        if (result.scored.length === 0 && result.skipped.length === 0 && result.errors.length === 0) {
            return NextResponse.json({
                scored: [],
                skipped: [],
                errors: [],
                message: result.message || 'No jobs in date range (newest to 2 months old)',
            });
        }

        // Check for errors
        if (result.errors.length > 0 && result.scored.length === 0) {
            return NextResponse.json({
                scored: result.scored,
                skipped: result.skipped,
                errors: result.errors,
                message: result.message,
            }, { status: 500 });
        }

        return NextResponse.json({
            scored: result.scored,
            skipped: result.skipped,
            errors: result.errors,
            summary: result.summary,
            message: result.message,
        });

    } catch (error) {
        console.error('[ScoreJobs] Pipeline error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Score Jobs pipeline failed' },
            { status: 500 }
        );
    }
}

// GET handler for checking pipeline status
export async function GET() {
    return NextResponse.json({
        status: 'ready',
        version: '2.0',
        features: [
            'LLM extraction for skills/industry/seniority',
            'Deterministic skill matching',
            'Confidence scoring',
            'Explainable breakdown',
            'Date range: newest to 2 months old',
        ]
    });
}
