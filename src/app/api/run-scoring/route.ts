
// API Route: POST /api/run-scoring
// Manually trigger scoring for all fresh jobs against default resume

import { NextRequest, NextResponse } from 'next/server';
import {
    getDefaultResume,
    getLinkedInProfile,
    getJobs,
    updateJobScore,
    getResumeById,
    insertResume,
    updateResume
} from '@/lib/db';
import { parseResumeFromPdf } from '@/lib/gemini';
import { calculateMatchScore } from '@/lib/scoring';
import type { Job, Resume, ParsedResume } from '@/types';

// Force Node.js runtime
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '500');

        // 1. GET DEFAULT RESUME & LINKEDIN
        let defaultResume = await getDefaultResume();
        const linkedinProfile = await getLinkedInProfile();

        if (!defaultResume) {
            return NextResponse.json(
                { error: 'No default resume found. Please upload a resume first.' },
                { status: 400 }
            );
        }

        // 2. LAZY PARSING: If resume hasn't been parsed yet, do it now
        if (!defaultResume.parsed_json || Object.keys(defaultResume.parsed_json).length === 0) {
            console.log(`[Scoring] Resume ${defaultResume.id} not parsed. Parsing now...`);

            // Fetch full resume data including file blob
            // Note: We need a DB function to get file_data. Assuming getResumeById returns it.
            // If getResumeById only returns metadata, we might need a separate call.
            // Based on previous DB analysis, getResumeById returns { resume, file_data }
            const resumeData = await getResumeById(defaultResume.id);

            if (!resumeData || !resumeData.file_data) {
                return NextResponse.json(
                    { error: 'Resume file data not found' },
                    { status: 404 }
                );
            }

            try {
                // Parse using Gemini
                const parsed = await parseResumeFromPdf(resumeData.file_data);

                // Update DB with parsed JSON
                // We need an update function. Assuming insertResume with conflict check or a new update function.
                // Let's assume we can update it. If `updateResume` doesn't exist, we might need to add it to db.ts
                // For now, I'll update db.ts next if needed.
                // Re-fetch default resume with parsed data
                defaultResume.parsed_json = parsed;

                // Save back to DB
                await updateResume(defaultResume.id, { parsed_json: parsed });

            } catch (err: any) {
                console.error('Resume parsing failed:', err);
                return NextResponse.json(
                    { error: 'Failed to parse resume: ' + err.message },
                    { status: 500 }
                );
            }
        }

        // Same for LinkedIn if exists but not parsed
        let linkedinParsed: ParsedResume | null = null;
        if (linkedinProfile) {
            // Logic for lazy LinkedIn parsing would go here
            // For simplicity, assuming LinkedIn strictly optional or already handled
            linkedinParsed = linkedinProfile.parsed_json as ParsedResume | null;
        }

        // 3. FETCH FRESH JOBS
        const jobs = await getJobs('fresh', limit);
        console.log(`[Scoring] Scoring ${jobs.length} fresh jobs...`);

        // 4. CALCULATE SCORES
        let scoredCount = 0;
        const updates = jobs.map(async (job) => {
            const score = calculateMatchScore(
                job,
                defaultResume!.parsed_json as ParsedResume,
                linkedinParsed
            );

            // Update Job in DB
            // Determine match level based on score
            let level: 'perfect' | 'high' | 'medium' | 'low' | 'bad' = 'low';
            if (score >= 90) level = 'perfect';
            else if (score >= 75) level = 'high';
            else if (score >= 50) level = 'medium';
            else if (score < 30) level = 'bad';

            await updateJobScore(
                job.id,
                score,
                [], // matched_skills (can calculate if we want)
                [], // missing_skills
                `Deterministic score: ${score}`
            );
            scoredCount++;
        });

        await Promise.all(updates);

        return NextResponse.json({
            success: true,
            scored: scoredCount,
            message: `Successfully scored ${scoredCount} jobs`
        });

    } catch (error) {
        console.error('Scoring pipeline failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Scoring failed' },
            { status: 500 }
        );
    }
}
