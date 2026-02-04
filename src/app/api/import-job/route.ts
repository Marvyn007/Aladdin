import { NextRequest, NextResponse } from 'next/server';
import {
    insertJob,
    getDefaultResume,
    getLinkedInProfile,
    updateJobScore,
    getResumeById,
    updateResume
} from '@/lib/db';
import { scoreJob, parseResumeFromPdf } from '@/lib/gemini';
import type { ParsedResume } from '@/types';
import type { ScrapeResult } from '@/lib/job-scraper-fetch';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow longer for scraping

import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log('[Import] Scraping job page:', url);

        // Always use fetch-based scraper for speed (instant imports)
        // Puppeteer is slow (60+ seconds) and problematic on serverless
        const { scrapeJobPageFetch } = await import('@/lib/job-scraper-fetch');
        const scrapeResult = await scrapeJobPageFetch(url);
        console.log('[Import] Using fetch-based scraper (fast)');

        console.log('[Import] Extracted:', {
            title: scrapeResult.title,
            company: scrapeResult.company,
            location: scrapeResult.location,
            descriptionLength: scrapeResult.job_description_plain.length,
            confidence: scrapeResult.confidence
        });

        // Log warnings for low confidence
        if (scrapeResult.confidence.description < 0.5) {
            console.warn('[Import] Low confidence for description:', scrapeResult.confidence.description);
        }
        if (scrapeResult.confidence.date < 0.5) {
            console.warn('[Import] Low confidence for date:', scrapeResult.confidence.date);
        }
        if (scrapeResult.confidence.location < 0.5) {
            console.warn('[Import] Low confidence for location:', scrapeResult.confidence.location);
        }

        // Insert job with all new fields
        const newJob = await insertJob(userId, {
            title: scrapeResult.title,
            company: scrapeResult.company,
            location: scrapeResult.location,
            source_url: url,
            posted_at: scrapeResult.date_posted_iso || scrapeResult.scraped_at,
            normalized_text: scrapeResult.job_description_plain,
            raw_text_summary: scrapeResult.job_description_plain, // Full text, no truncation
            isImported: true,
            original_posted_date: scrapeResult.date_posted_iso,
            original_posted_raw: scrapeResult.date_posted_display,
            original_posted_source: scrapeResult.date_posted_relative ? 'relative' : 'absolute',
            location_display: scrapeResult.location,
            import_tag: 'imported',
            // V2 fields
            raw_description_html: scrapeResult.raw_description_html,
            job_description_plain: scrapeResult.job_description_plain,
            date_posted_iso: scrapeResult.date_posted_iso,
            date_posted_display: scrapeResult.date_posted_display,
            date_posted_relative: scrapeResult.date_posted_relative,
            source_host: scrapeResult.source_host,
            scraped_at: scrapeResult.scraped_at,
            extraction_confidence: scrapeResult.confidence
        });

        console.log('[Import] Job inserted:', newJob.id);

        // Scoring with DETERMINISTIC skill matching
        const defaultResume = await getDefaultResume(userId);
        const linkedinProfile = await getLinkedInProfile(userId);
        let score = 0;
        let matchedSkills: string[] = [];
        let missingSkills: string[] = [];
        let why = 'Imported job';

        if (defaultResume) {
            // Lazy parse resume if needed
            if (!defaultResume.parsed_json || Object.keys(defaultResume.parsed_json).length === 0) {
                console.log('[Import] Parsing default resume for first time...');
                const resumeData = await getResumeById(userId, defaultResume.id);
                if (resumeData?.file_data) {
                    const parsed = await parseResumeFromPdf(resumeData.file_data);
                    defaultResume.parsed_json = parsed;
                    await updateResume(userId, defaultResume.id, { parsed_json: parsed });
                }
            }

            const linkedinParsed = linkedinProfile?.parsed_json as ParsedResume | null;

            // DETERMINISTIC: Extract resume skills
            const resumeParsed = defaultResume.parsed_json as ParsedResume;
            const resumeSkillNames: string[] = [];
            if (resumeParsed.skills) {
                for (const skill of resumeParsed.skills) {
                    if (typeof skill === 'string') {
                        resumeSkillNames.push(skill);
                    } else if (skill && typeof skill === 'object' && 'name' in skill) {
                        resumeSkillNames.push((skill as any).name);
                    }
                }
            }

            // DETERMINISTIC: Match skills against job text
            const { analyzeSkills } = await import('@/lib/skill-matcher');
            const jobText = scrapeResult.job_description_plain || '';
            const skillAnalysis = analyzeSkills(jobText, resumeSkillNames);

            matchedSkills = skillAnalysis.matched;
            missingSkills = skillAnalysis.missing;

            console.log('[Import] Deterministic skills:', {
                matched: matchedSkills.length,
                missing: missingSkills.length,
                jobSkillsFound: skillAnalysis.jobSkills.length
            });

            // AI: Get score and explanation only
            try {
                const scoreResult = await scoreJob(resumeParsed, linkedinParsed, newJob);
                score = scoreResult.match_score;
                why = scoreResult.why || 'Imported and scored';
                // IGNORE AI's skill suggestions - use deterministic instead
            } catch (aiErr: any) {
                console.warn('[Import] AI scoring failed, using skill-based fallback');
                if (skillAnalysis.jobSkills.length > 0) {
                    score = Math.round((matchedSkills.length / skillAnalysis.jobSkills.length) * 100);
                    why = `${matchedSkills.length}/${skillAnalysis.jobSkills.length} skills matched`;
                }
            }

            await updateJobScore(
                userId,
                newJob.id,
                score,
                matchedSkills,    // ← DETERMINISTIC: 100% accurate
                missingSkills,    // ← DETERMINISTIC: 100% accurate
                why
            );
        }

        const finalJob = { ...newJob, match_score: score };

        // Return full scrape result for transparency
        return NextResponse.json({
            success: true,
            job: finalJob,
            scrape_metadata: {
                source_host: scrapeResult.source_host,
                scraped_at: scrapeResult.scraped_at,
                confidence: scrapeResult.confidence,
                description_length: scrapeResult.job_description_plain.length,
                date_posted_display: scrapeResult.date_posted_display
            }
        });

    } catch (error: any) {
        console.error('Import Job Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to import job' }, { status: 500 });
    }
}
