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
import { scrapeJobPage } from '@/lib/job-scraper-v2';
import type { ParsedResume } from '@/types';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const { url } = await req.json();

        if (!url) {
            return NextResponse.json({ error: 'URL is required' }, { status: 400 });
        }

        console.log('[Import] Scraping job page:', url);

        // Use the new V2 scraper
        const scrapeResult = await scrapeJobPage(url);

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
        const newJob = await insertJob({
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

        // Scoring
        const defaultResume = await getDefaultResume();
        const linkedinProfile = await getLinkedInProfile();
        let score = 0;

        if (defaultResume) {
            // Lazy parse resume if needed
            if (!defaultResume.parsed_json || Object.keys(defaultResume.parsed_json).length === 0) {
                console.log('[Import] Parsing default resume for first time...');
                const resumeData = await getResumeById(defaultResume.id);
                if (resumeData?.file_data) {
                    const parsed = await parseResumeFromPdf(resumeData.file_data);
                    defaultResume.parsed_json = parsed;
                    await updateResume(defaultResume.id, { parsed_json: parsed });
                }
            }

            const linkedinParsed = linkedinProfile?.parsed_json as ParsedResume | null;

            console.log('[Import] Scoring job...');
            const scoreResult = await scoreJob(
                defaultResume.parsed_json as ParsedResume,
                linkedinParsed,
                newJob
            );

            score = scoreResult.match_score;

            await updateJobScore(
                newJob.id,
                score,
                scoreResult.matched_skills,
                scoreResult.missing_important_skills || [],
                scoreResult.why || 'Imported and scored'
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
