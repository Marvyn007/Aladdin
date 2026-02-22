/**
 * Job Scraper - Fetch-based (Serverless Compatible)
 * 
 * Uses native fetch + regex-based HTML parsing.
 * Works on Vercel/Lambda without Puppeteer.
 * 
 * Limitations:
 * - Cannot execute JavaScript (no lazy-loaded content)
 * - May not work on heavily JS-dependent job boards
 * - Works well with: LinkedIn, Indeed, Greenhouse, Lever, Workday
 */

import { cleanHtmlToText } from './text-cleaner';

export interface ScrapeResult {
    title: string;
    company: string;
    source_url: string;
    source_host: string;
    raw_description_html: string;
    job_description_plain: string;
    normalized_text: string;
    extracted_skills?: string[];
    company_logo_url?: string | null;
    date_posted_iso: string | null;
    date_posted_display: string;
    date_posted_relative: boolean;
    location: string;
    scraped_at: string;
    confidence: {
        description: number;
        date: number;
        location: number;
    };
}

/**
 * Parse relative date to ISO string
 */
function parseRelativeDate(text: string): { iso: string | null; display: string; isRelative: boolean } {
    const lower = text.toLowerCase().trim();
    const now = new Date();

    const relativeRegex = /(\d+|a|an)\s+(minute|hour|day|week|month)s?\s+ago/i;
    const match = lower.match(relativeRegex);

    if (match) {
        const numStr = match[1];
        const num = numStr === 'a' || numStr === 'an' ? 1 : parseInt(numStr, 10);
        const unit = match[2].toLowerCase();

        let ms = 0;
        if (unit.includes('minute')) ms = num * 60 * 1000;
        else if (unit.includes('hour')) ms = num * 60 * 60 * 1000;
        else if (unit.includes('day')) ms = num * 24 * 60 * 60 * 1000;
        else if (unit.includes('week')) ms = num * 7 * 24 * 60 * 60 * 1000;
        else if (unit.includes('month')) ms = num * 30 * 24 * 60 * 60 * 1000;

        const iso = new Date(now.getTime() - ms).toISOString();
        return { iso, display: `Posted: ${match[0]}`, isRelative: true };
    }

    const parsed = Date.parse(text);
    if (!isNaN(parsed)) {
        const date = new Date(parsed);
        const display = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        return { iso: date.toISOString(), display: `Posted: ${display}`, isRelative: false };
    }

    return { iso: null, display: 'Posted: Unknown', isRelative: false };
}

/**
 * Extract content between tags using regex
 */
function extractBetween(html: string, startPattern: RegExp, endPattern: RegExp): string {
    const startMatch = html.match(startPattern);
    if (!startMatch) return '';

    const startIdx = html.indexOf(startMatch[0]) + startMatch[0].length;
    const endMatch = html.slice(startIdx).match(endPattern);
    if (!endMatch) return html.slice(startIdx);

    return html.slice(startIdx, startIdx + html.slice(startIdx).indexOf(endMatch[0]));
}

/**
 * Extract meta tag content
 */
function getMetaContent(html: string, names: string[]): string | null {
    for (const name of names) {
        // Try name attribute
        const nameMatch = html.match(new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
        if (nameMatch) return nameMatch[1];

        // Try property attribute (OpenGraph)
        const propMatch = html.match(new RegExp(`<meta[^>]*property=["']${name}["'][^>]*content=["']([^"']+)["']`, 'i'));
        if (propMatch) return propMatch[1];

        // Try reversed order
        const revMatch = html.match(new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${name}["']`, 'i'));
        if (revMatch) return revMatch[1];
    }
    return null;
}

/**
 * Extract JSON-LD JobPosting data
 */
function extractJsonLd(html: string): any {
    const scriptMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

    for (const match of scriptMatches) {
        try {
            const json = JSON.parse(match[1]);

            // Direct JobPosting
            if (json['@type'] === 'JobPosting') return json;

            // In @graph array
            if (Array.isArray(json['@graph'])) {
                const found = json['@graph'].find((item: any) => item['@type'] === 'JobPosting');
                if (found) return found;
            }

            // Array of items
            if (Array.isArray(json)) {
                const found = json.find((item: any) => item['@type'] === 'JobPosting');
                if (found) return found;
            }
        } catch (e) {
            // Invalid JSON, continue
        }
    }
    return {};
}

/**
 * Main fetch-based scraping function
 */
export async function scrapeJobPageFetch(url: string): Promise<ScrapeResult> {
    const scrapedAt = new Date().toISOString();
    const sourceHost = new URL(url).hostname.replace('www.', '');

    // Fetch the page
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract JSON-LD first (most reliable)
    const jsonLd = extractJsonLd(html);

    // Title
    let title = jsonLd.title || '';
    if (!title) {
        title = getMetaContent(html, ['og:title', 'twitter:title']) || '';
    }
    if (!title) {
        const h1Match = html.match(/<h1[^>]*>([^<]+)</i);
        title = h1Match ? h1Match[1].trim() : '';
    }
    if (!title) {
        const titleMatch = html.match(/<title>([^<]+)</i);
        title = titleMatch ? titleMatch[1].split('|')[0].trim() : 'Unknown Job';
    }

    // Company
    let company = '';
    if (jsonLd.hiringOrganization?.name) {
        company = jsonLd.hiringOrganization.name;
    } else {
        company = getMetaContent(html, ['og:site_name']) || 'Unknown Company';
    }

    // Description
    let rawHtml = '';
    let confidence_desc = 0;

    if (jsonLd.description && jsonLd.description.length > 100) {
        rawHtml = jsonLd.description;
        confidence_desc = 0.95;
    }

    if (!rawHtml || rawHtml.length < 200) {
        // Try common description containers
        const descPatterns = [
            /<div[^>]*(?:id|class)=["'][^"']*job-description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
            /<div[^>]*(?:id|class)=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
            /<section[^>]*(?:id|class)=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/section>/i,
            /<article[^>]*>([\s\S]*?)<\/article>/i,
        ];

        for (const pattern of descPatterns) {
            const match = html.match(pattern);
            if (match && match[1].length > rawHtml.length) {
                rawHtml = match[1];
                confidence_desc = 0.75;
            }
        }
    }

    // Fallback: get main content area
    if (!rawHtml || rawHtml.length < 300) {
        const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
        if (mainMatch && mainMatch[1].length > rawHtml.length) {
            rawHtml = mainMatch[1];
            confidence_desc = 0.5;
        }
    }

    // Date
    let dateRaw = '';
    let confidence_date = 0;

    if (jsonLd.datePosted) {
        dateRaw = jsonLd.datePosted;
        confidence_date = 0.95;
    } else if (jsonLd.datePublished) {
        dateRaw = jsonLd.datePublished;
        confidence_date = 0.9;
    }

    if (!dateRaw) {
        const metaDate = getMetaContent(html, ['date', 'article:published_time', 'publication_date']);
        if (metaDate) {
            dateRaw = metaDate;
            confidence_date = 0.8;
        }
    }

    if (!dateRaw) {
        // Look for relative date in text
        const relativeMatch = html.match(/(\d+|a|an)\s+(minute|hour|day|week|month)s?\s+ago/i);
        if (relativeMatch) {
            dateRaw = relativeMatch[0];
            confidence_date = 0.6;
        }
    }

    // Location
    let location = '';
    let confidence_loc = 0;

    if (jsonLd.jobLocationType === 'TELECOMMUTE') {
        location = 'Remote';
        confidence_loc = 0.95;
    } else if (jsonLd.jobLocation?.address) {
        const addr = jsonLd.jobLocation.address;
        if (typeof addr === 'string') {
            location = addr;
        } else if (addr.addressLocality) {
            const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
            location = parts.join(', ');
        }
        confidence_loc = 0.9;
    }

    if (!location) {
        const metaLoc = getMetaContent(html, ['location', 'og:location', 'geo.placename']);
        if (metaLoc) {
            location = metaLoc;
            confidence_loc = 0.75;
        }
    }

    if (!location) {
        // Look for city, state pattern
        const locMatch = html.match(/([A-Z][a-z]+(?:\s[A-Z][a-z]+)*),\s*[A-Z]{2}(?:\s|<|,)/);
        if (locMatch) {
            location = locMatch[0].replace(/<.*/, '').trim();
            confidence_loc = 0.5;
        }
    }

    if (!location) {
        if (/remote/i.test(html.slice(0, 5000))) {
            location = 'Remote';
            confidence_loc = 0.4;
        } else {
            location = 'Not found';
            confidence_loc = 0.1;
        }
    }

    // Parse date
    let datePostedIso: string | null = null;
    let datePostedDisplay = 'Posted: Unknown';
    let datePostedRelative = false;

    if (dateRaw) {
        const parsed = parseRelativeDate(dateRaw);
        datePostedIso = parsed.iso;
        datePostedDisplay = parsed.display;
        datePostedRelative = parsed.isRelative;
    } else {
        datePostedIso = scrapedAt;
        datePostedDisplay = 'Posted: Today';
    }

    // Clean text
    const jobDescriptionPlain = cleanHtmlToText(rawHtml);

    return {
        title: title.trim(),
        company: company.trim(),
        source_url: url,
        source_host: sourceHost,
        raw_description_html: rawHtml,
        job_description_plain: jobDescriptionPlain,
        normalized_text: jobDescriptionPlain,
        date_posted_iso: datePostedIso,
        date_posted_display: datePostedDisplay,
        date_posted_relative: datePostedRelative,
        location: location.trim(),
        scraped_at: scrapedAt,
        confidence: {
            description: confidence_desc,
            date: confidence_date,
            location: confidence_loc,
        },
    };
}
