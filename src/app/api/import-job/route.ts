import { NextRequest, NextResponse } from 'next/server';
import {
    insertJob,
    getDefaultResume,
    getLinkedInProfile,
    updateJobScore,
    getResumeById,
    updateResume,
    getPostedByUserInfo,
} from '@/lib/db';
import { scoreJob, parseResumeFromPdf, verifyJobAuthenticity } from '@/lib/gemini';
import type { ParsedResume, ResumeSkill } from '@/types';
import type { ScrapeResult } from '@/lib/job-scraper-fetch';
import { scrapeJobPageFetch } from '@/lib/job-scraper-fetch';
import {
    validateJobSourceDomain,
    validateJobDescription,
    validateJobScrapeResult,
    getValidationErrorMessage,
} from '@/lib/job-validation';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

import { auth, currentUser } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { url, description, title, company, location, bypassValidation } = await req.json();

        if (!url && !description) {
            return NextResponse.json(
                { error: 'Either url or description is required' },
                { status: 400 }
            );
        }

        let scrapeResult: ScrapeResult;

        if (description) {
            const descValidation = validateJobDescription(description);
            if (!descValidation.valid && !bypassValidation) {
                return NextResponse.json(
                    {
                        error: getValidationErrorMessage({ descriptionValidation: descValidation }),
                        canBypass: true
                    },
                    { status: 400 }
                );
            }

            // Manual flow
            // If URL is provided in manual flow, we must run Authenticity Verification
            if (url) {
                console.log(`[Import API] Running Authentic Verification for manual job: ${url}`);
                try {
                    // 1. Scrape the URL to get the Ground Truth
                    const groundTruth = await scrapeJobPageFetch(url);

                    // 2. Run the Dual ML Verification (Mismatch + Scam Check)
                    const verification = await verifyJobAuthenticity(
                        groundTruth.job_description_plain || groundTruth.raw_description_html || '',
                        { title: title || '', company: company || '', description }
                    );

                    console.log(`[Import API] Verification Result:`, verification);

                    if (!verification.isAuthentic) {
                        return NextResponse.json(
                            {
                                error: 'Job fails authenticity verification.',
                                details: verification.reasoning,
                                action: 'authenticity_failed'
                            },
                            { status: 400 }
                        );
                    }
                } catch (verifyError: any) {
                    console.error('[Import API] Verification process errored out:', verifyError);
                    // Decide if we block on error. Given strict security requirement, we should probably warn or block.
                    // Let's block to force secure behavior, or at least log it.
                    return NextResponse.json(
                        { error: `Verification service failed: ${verifyError.message || 'Unknown error'}` },
                        { status: 500 }
                    );
                }
            }

            scrapeResult = {
                title: title || 'Manually Imported Job',
                company: company || 'Unknown Company',
                location: location || 'Not specified',
                source_url: url || 'manual-import',
                source_host: url ? new URL(url).hostname : 'manual',
                raw_description_html: description,
                normalized_text: description,
                extracted_skills: [],
                extraction_confidence: 1.0,
                job_description_plain: description, // Keep this for compatibility with existing code
                date_posted_iso: new Date().toISOString(),
                date_posted_display: 'Today',
                date_posted_relative: false,
                scraped_at: new Date().toISOString(),
            };
        } else {
            if (!url) {
                return NextResponse.json(
                    { error: 'URL is required' },
                    { status: 400 }
                );
            }

            const domainValidation = validateJobSourceDomain(url);
            if (!domainValidation.valid && !bypassValidation) {
                return NextResponse.json(
                    {
                        error: getValidationErrorMessage({ domainValidation }),
                        warning: 'Jobs cannot be fetched from LinkedIn, Indeed, or Glassdoor. Please use the original job posting link instead.',
                        canBypass: true
                    },
                    { status: 400 }
                );
            }

            console.log('[Import] Scraping job page:', url);

            const { scrapeJobPageFetch } = await import('@/lib/job-scraper-fetch');
            const fetchedResult = await scrapeJobPageFetch(url);
            console.log('[Import] Using fetch-based scraper (fast)');

            console.log('[Import] Extracted:', {
                title: fetchedResult.title,
                company: fetchedResult.company,
                location: fetchedResult.location,
                descriptionLength: fetchedResult.job_description_plain.length,
                confidence: fetchedResult.confidence
            });

            const scrapeValidation = validateJobScrapeResult(fetchedResult);
            if (!scrapeValidation.valid && !bypassValidation) {
                console.error('[Import] Scrape validation failed:', scrapeValidation.reasons);
                return NextResponse.json(
                    {
                        error: getValidationErrorMessage({ scrapeValidation }),
                        canBypass: true
                    },
                    { status: 400 }
                );
            }

            scrapeResult = fetchedResult;
        }

        const user = await currentUser();

        const newJob = await insertJob(userId, {
            title: scrapeResult.title,
            company: scrapeResult.company,
            location: scrapeResult.location,
            source_url: scrapeResult.source_url,
            posted_at: scrapeResult.date_posted_iso || scrapeResult.scraped_at,
            normalized_text: scrapeResult.job_description_plain,
            raw_text_summary: scrapeResult.job_description_plain,
            isImported: true,
            original_posted_date: scrapeResult.date_posted_iso,
            original_posted_raw: scrapeResult.date_posted_display,
            original_posted_source: scrapeResult.date_posted_relative ? 'relative' : 'absolute',
            location_display: scrapeResult.location,
            import_tag: 'imported',
            raw_description_html: scrapeResult.raw_description_html,
            job_description_plain: scrapeResult.job_description_plain,
            date_posted_iso: scrapeResult.date_posted_iso,
            date_posted_display: scrapeResult.date_posted_display,
            date_posted_relative: scrapeResult.date_posted_relative,
            source_host: scrapeResult.source_host,
            scraped_at: scrapeResult.scraped_at,
            extraction_confidence: scrapeResult.confidence
        }, user ? {
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl
        } : undefined);

        console.log('[Import] Job inserted:', newJob.id);

        const defaultResume = await getDefaultResume(userId);
        const linkedinProfile = await getLinkedInProfile(userId);
        let score = 0;
        let matchedSkills: string[] = [];
        let missingSkills: string[] = [];
        let why = 'Imported job';

        if (defaultResume) {
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

            const resumeParsed = defaultResume.parsed_json as ParsedResume;
            const resumeSkillNames: string[] = [];
            if (resumeParsed.skills) {
                for (const skill of resumeParsed.skills) {
                    if (typeof skill === 'string') {
                        resumeSkillNames.push(skill);
                    } else if (skill && typeof skill === 'object' && 'name' in skill) {
                        resumeSkillNames.push((skill as ResumeSkill).name);
                    }
                }
            }

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

            try {
                const scoreResult = await scoreJob(resumeParsed, linkedinParsed, newJob);
                score = scoreResult.match_score;
                why = scoreResult.why || 'Imported and scored';
            } catch {
                console.warn('[Import] AI scoring failed, using skill-based fallback');
            }
        }

        await updateJobScore(userId, newJob.id, score, matchedSkills, missingSkills, why);

        const postedByUser = await getPostedByUserInfo(newJob.id);

        return NextResponse.json({
            success: true,
            job: {
                ...newJob,
                postedBy: postedByUser
            }
        });

    } catch (error: unknown) {
        console.error('[Import] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: errorMessage || 'Failed to import job' }, { status: 500 });
    }
}
