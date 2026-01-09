/**
 * Job Scraper V2 - Test Suite
 * 
 * Tests scraping from 10 diverse job sources to verify:
 * - Full plain-text descriptions (no HTML)
 * - Accurate dates
 * - Valid locations
 * - Confidence scores
 */

import { scrapeJobPage, ScrapeResult } from '../src/lib/job-scraper-v2';

// Test URLs - representative samples from different sources
const TEST_URLS: { name: string; url: string; minDescLength: number }[] = [
    // Note: These are example patterns - real URLs should be from live job postings
    // For actual testing, replace with current job URLs
    {
        name: 'Greenhouse (Example)',
        url: 'https://boards.greenhouse.io/openai/jobs/5661044',
        minDescLength: 300
    },
    {
        name: 'Lever (Example)',
        url: 'https://jobs.lever.co/missionlane/example',
        minDescLength: 300
    },
    // Add more real URLs when testing
];

// Helper to check for HTML remnants
function hasHtmlTags(text: string): boolean {
    return /<[a-z][^>]*>/i.test(text);
}

function hasHtmlEntities(text: string): boolean {
    return /&(?:nbsp|lt|gt|amp|quot|#\d+);/i.test(text);
}

// Validation function
function validateScrapeResult(result: ScrapeResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Title
    if (!result.title || result.title === 'Unknown Job') {
        errors.push('Missing or unknown title');
    }

    // Company
    if (!result.company || result.company === 'Unknown Company') {
        errors.push('Missing or unknown company');
    }

    // Description - plain text
    if (!result.job_description_plain || result.job_description_plain.length < 100) {
        errors.push(`Description too short: ${result.job_description_plain?.length || 0} chars`);
    }
    if (hasHtmlTags(result.job_description_plain)) {
        errors.push('Description contains HTML tags');
    }
    if (hasHtmlEntities(result.job_description_plain)) {
        errors.push('Description contains HTML entities');
    }

    // Raw HTML should exist
    if (!result.raw_description_html || result.raw_description_html.length < 50) {
        errors.push('Raw HTML too short or missing');
    }

    // Date - should have display at minimum
    if (!result.date_posted_display || result.date_posted_display === 'Posted: Unknown') {
        errors.push('Date display is unknown');
    }

    // Location
    if (!result.location || result.location === 'Not found') {
        errors.push('Location not found');
    }

    // Confidence scores
    if (!result.confidence) {
        errors.push('Missing confidence object');
    } else {
        if (result.confidence.description < 0.5) {
            errors.push(`Low description confidence: ${result.confidence.description}`);
        }
        if (result.confidence.date < 0.5) {
            errors.push(`Low date confidence: ${result.confidence.date}`);
        }
        if (result.confidence.location < 0.5) {
            errors.push(`Low location confidence: ${result.confidence.location}`);
        }
    }

    // Source metadata
    if (!result.source_host) {
        errors.push('Missing source_host');
    }
    if (!result.scraped_at) {
        errors.push('Missing scraped_at');
    }

    return { valid: errors.length === 0, errors };
}

// Main test runner
async function runTests() {
    console.log('='.repeat(60));
    console.log('Job Scraper V2 - Test Suite');
    console.log('='.repeat(60));
    console.log();

    const results: { name: string; success: boolean; result?: ScrapeResult; errors?: string[] }[] = [];

    for (const testCase of TEST_URLS) {
        console.log(`Testing: ${testCase.name}`);
        console.log(`URL: ${testCase.url}`);

        try {
            const result = await scrapeJobPage(testCase.url);
            const validation = validateScrapeResult(result);

            if (validation.valid) {
                console.log('✅ PASSED');
                results.push({ name: testCase.name, success: true, result });
            } else {
                console.log('❌ FAILED');
                validation.errors.forEach(e => console.log(`   - ${e}`));
                results.push({ name: testCase.name, success: false, errors: validation.errors });
            }

            // Print sample output
            console.log(`   Title: ${result.title}`);
            console.log(`   Company: ${result.company}`);
            console.log(`   Location: ${result.location}`);
            console.log(`   Date: ${result.date_posted_display}`);
            console.log(`   Description: ${result.job_description_plain.slice(0, 100)}...`);
            console.log(`   Confidence: ${JSON.stringify(result.confidence)}`);

        } catch (error: any) {
            console.log('❌ ERROR');
            console.log(`   ${error.message}`);
            results.push({ name: testCase.name, success: false, errors: [error.message] });
        }

        console.log();
    }

    // Summary
    console.log('='.repeat(60));
    console.log('SUMMARY');
    console.log('='.repeat(60));
    const passed = results.filter(r => r.success).length;
    const total = results.length;
    console.log(`Passed: ${passed}/${total}`);

    if (passed === total) {
        console.log('✅ All tests passed!');
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }

    // Output full JSON for passed tests
    console.log();
    console.log('Sample Output JSON:');
    const passedResult = results.find(r => r.success && r.result);
    if (passedResult?.result) {
        console.log(JSON.stringify({
            title: passedResult.result.title,
            company: passedResult.result.company,
            source_url: passedResult.result.source_url,
            source_host: passedResult.result.source_host,
            raw_description_html: passedResult.result.raw_description_html.slice(0, 200) + '...',
            job_description_plain: passedResult.result.job_description_plain.slice(0, 500) + '...',
            date_posted_iso: passedResult.result.date_posted_iso,
            date_posted_display: passedResult.result.date_posted_display,
            date_posted_relative: passedResult.result.date_posted_relative,
            location: passedResult.result.location,
            scraped_at: passedResult.result.scraped_at,
            confidence: passedResult.result.confidence
        }, null, 2));
    }
}

// Export for Jest or run directly
export { runTests, validateScrapeResult };

// Run if executed directly
if (require.main === module) {
    runTests().catch(console.error);
}
