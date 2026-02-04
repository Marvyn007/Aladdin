
// API Route: POST /api/run-scoring
// HYBRID SCORING: AI for score + explanation, DETERMINISTIC for skills
// Skills are 100% accurate - only skills that literally appear in job text

import { NextRequest, NextResponse } from 'next/server';
import {
    getDefaultResume,
    getLinkedInProfile,
    getJobs,
    updateJobScore,
    getResumeById,
    updateResume
} from '@/lib/db';
import { parseResumeFromPdf, scoreJob } from '@/lib/gemini';
import { analyzeSkills } from '@/lib/skill-matcher';
import type { ParsedResume } from '@/types';

// Force Node.js runtime
export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes for batch scoring

import { auth } from '@clerk/nextjs/server';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '50');

        // 1. GET DEFAULT RESUME & LINKEDIN
        let defaultResume = await getDefaultResume(userId);
        const linkedinProfile = await getLinkedInProfile(userId);

        if (!defaultResume) {
            return NextResponse.json(
                { error: 'No default resume found. Please upload a resume first.' },
                { status: 400 }
            );
        }

        // 2. LAZY PARSING: If resume hasn't been parsed yet, do it now
        if (!defaultResume.parsed_json || Object.keys(defaultResume.parsed_json).length === 0) {
            console.log(`[Scoring] Resume ${defaultResume.id} not parsed. Parsing now...`);

            const resumeData = await getResumeById(userId, defaultResume.id);

            if (!resumeData || !resumeData.file_data) {
                return NextResponse.json(
                    { error: 'Resume file data not found' },
                    { status: 404 }
                );
            }

            try {
                const parsed = await parseResumeFromPdf(resumeData.file_data);
                defaultResume.parsed_json = parsed;
                await updateResume(userId, defaultResume.id, { parsed_json: parsed });
            } catch (err: any) {
                console.error('Resume parsing failed:', err);
                return NextResponse.json(
                    { error: 'Failed to parse resume: ' + err.message },
                    { status: 500 }
                );
            }
        }

        // LinkedIn parsing
        let linkedinParsed: ParsedResume | null = null;
        if (linkedinProfile) {
            linkedinParsed = linkedinProfile.parsed_json as ParsedResume | null;
        }

        // Extract resume skills for deterministic matching
        const resumeParsed = defaultResume.parsed_json as ParsedResume;
        const resumeSkillNames: string[] = [];

        // Get skill names from parsed resume
        if (resumeParsed.skills) {
            for (const skill of resumeParsed.skills) {
                if (typeof skill === 'string') {
                    resumeSkillNames.push(skill);
                } else if (skill && typeof skill === 'object' && 'name' in skill) {
                    resumeSkillNames.push((skill as any).name);
                }
            }
        }

        console.log(`[Scoring] Resume has ${resumeSkillNames.length} skills for matching`);

        // 3. FETCH FRESH JOBS
        const jobs = await getJobs(userId, 'fresh', limit);
        console.log(`[Scoring] Scoring ${jobs.length} fresh jobs...`);

        // 4. HYBRID SCORING
        // - AI provides: match_score, why (explanation)
        // - CODE provides: matched_skills, missing_skills (100% accurate)
        let scoredCount = 0;
        let errorCount = 0;
        const results: { id: string; score: number; matched: number; missing: number }[] = [];

        for (const job of jobs) {
            try {
                console.log(`[Scoring] Processing: ${job.title} at ${job.company}`);

                // Get job text for skill extraction
                const jobText = job.job_description_plain || job.normalized_text || job.raw_text_summary || '';

                // DETERMINISTIC: Extract skills from job text using code-based matching
                const skillAnalysis = analyzeSkills(jobText, resumeSkillNames);

                console.log(`[Scoring] Job skills found: ${skillAnalysis.jobSkills.length}, Matched: ${skillAnalysis.matched.length}, Missing: ${skillAnalysis.missing.length}`);

                // AI: Get score and explanation (but ignore its skill suggestions)
                let aiScore = 50; // default
                let aiWhy = 'Score based on skill match analysis';

                try {
                    const scoreResult = await scoreJob(resumeParsed, linkedinParsed, job);
                    aiScore = scoreResult.match_score;
                    aiWhy = scoreResult.why || aiWhy;
                    // IGNORE scoreResult.matched_skills and missing_important_skills - use deterministic instead
                } catch (aiErr: any) {
                    console.warn(`[Scoring] AI scoring failed for ${job.id}, using skill-based score`);
                    // Fallback: Calculate score based on skill match ratio
                    if (skillAnalysis.jobSkills.length > 0) {
                        aiScore = Math.round((skillAnalysis.matched.length / skillAnalysis.jobSkills.length) * 100);
                    }
                }

                // Save to database with DETERMINISTIC skills (100% accurate)
                await updateJobScore(
                    userId,
                    job.id,
                    aiScore,
                    skillAnalysis.matched,    // ← DETERMINISTIC: Only skills literally in job text
                    skillAnalysis.missing,    // ← DETERMINISTIC: Only skills literally in job text
                    aiWhy
                );

                scoredCount++;
                results.push({
                    id: job.id,
                    score: aiScore,
                    matched: skillAnalysis.matched.length,
                    missing: skillAnalysis.missing.length
                });

                // Small delay to respect rate limits
                await new Promise(resolve => setTimeout(resolve, 200));

            } catch (err: any) {
                console.error(`[Scoring] Failed for job ${job.id}:`, err.message);
                errorCount++;
            }
        }

        return NextResponse.json({
            success: true,
            scored: scoredCount,
            errors: errorCount,
            message: `Scored ${scoredCount} jobs with 100% accurate skill matching`,
            sample: results.slice(0, 5)
        });

    } catch (error) {
        console.error('Scoring pipeline failed:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Scoring failed' },
            { status: 500 }
        );
    }
}
