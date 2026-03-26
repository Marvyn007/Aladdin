import { NextRequest, NextResponse } from 'next/server';
import { getPostedByUserInfo } from '@/lib/db';
import { importJob } from '@/lib/job-sources/import-service';
import { verifyJobAuthenticity } from '@/lib/openai';
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

import { auth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { url, description, title, company, location, company_logo_url, bypassValidation } = await req.json();

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
                confidence: { description: 1.0, date: 1.0, location: 1.0 },
                job_description_plain: description, // Keep this for compatibility with existing code
                date_posted_iso: new Date().toISOString(),
                date_posted_display: 'Today',
                date_posted_relative: false,
                scraped_at: new Date().toISOString(),
                company_logo_url: company_logo_url || null,
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

        const { job, isDuplicate } = await importJob({
            title: scrapeResult.title,
            company: scrapeResult.company,
            location: scrapeResult.location,
            sourceUrl: scrapeResult.source_url,
            applyUrl: scrapeResult.source_url,
            rawDescriptionHtml: scrapeResult.raw_description_html,
            jobDescriptionPlain: scrapeResult.job_description_plain,
            postedByUserId: userId,
        });

        if (isDuplicate) {
            console.log('[Import] Duplicate detected, returning existing job:', job.id);
        } else {
            console.log('[Import] Job inserted:', job.id);
        }

        const postedByUser = await getPostedByUserInfo(job.id as string);

        return NextResponse.json({
            success: true,
            isDuplicate,
            job: {
                ...job,
                postedBy: postedByUser
            }
        });

    } catch (error: unknown) {
        console.error('[Import] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        return NextResponse.json({ error: errorMessage || 'Failed to import job' }, { status: 500 });
    }
}
