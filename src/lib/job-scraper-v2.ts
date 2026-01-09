/**
 * Job Scraper V2
 * 
 * Complete job page scraping with:
 * - Full HTML preservation
 * - Clean plain text extraction
 * - Date parsing (ISO + display)
 * - Location extraction
 * - Confidence scoring
 */

import puppeteer, { Page } from 'puppeteer';
import { cleanHtmlToText } from './text-cleaner';

// Types
export interface ExtractionConfidence {
    description: number;
    date: number;
    location: number;
}

export interface ScrapeResult {
    title: string;
    company: string;
    source_url: string;
    source_host: string;
    raw_description_html: string;
    job_description_plain: string;
    date_posted_iso: string | null;
    date_posted_display: string;
    date_posted_relative: boolean;
    location: string;
    scraped_at: string;
    confidence: ExtractionConfidence;
}

/**
 * Parse relative date string to ISO
 */
function parseRelativeDate(text: string): { iso: string | null; display: string; isRelative: boolean } {
    const lower = text.toLowerCase().trim();
    const now = new Date();

    // Relative patterns
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

    // Try parsing as absolute date
    const parsed = Date.parse(text);
    if (!isNaN(parsed)) {
        const date = new Date(parsed);
        const display = date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });
        return { iso: date.toISOString(), display: `Posted: ${display}`, isRelative: false };
    }

    return { iso: null, display: 'Posted: Unknown', isRelative: false };
}

/**
 * Compute display string from ISO date
 */
function computeDateDisplay(iso: string): string {
    const date = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Posted: Today';
    if (diffDays === 1) return 'Posted: Yesterday';
    if (diffDays < 7) return `Posted: ${diffDays} days ago`;
    if (diffDays < 30) return `Posted: ${Math.floor(diffDays / 7)} week${diffDays >= 14 ? 's' : ''} ago`;
    if (diffDays < 365) return `Posted: ${Math.floor(diffDays / 30)} month${diffDays >= 60 ? 's' : ''} ago`;
    return `Posted: ${date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}`;
}

/**
 * Main scraping function
 */
export async function scrapeJobPage(url: string): Promise<ScrapeResult> {
    const scrapedAt = new Date().toISOString();
    const sourceHost = new URL(url).hostname.replace('www.', '');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    try {
        const page = await browser.newPage();

        // Block heavy resources but keep CSS
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Navigate with networkidle2 for lazy-loaded content
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });

        // Scroll to trigger lazy loading
        await autoScroll(page);

        // Extract data
        const data = await page.evaluate(() => {
            // Helper functions
            const getMeta = (names: string[]) => {
                for (const name of names) {
                    const el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
                    const content = el?.getAttribute('content');
                    if (content) return content;
                }
                return null;
            };

            // Deep JSON-LD traversal
            const findJobPosting = (obj: any, depth: number = 0): any => {
                if (depth > 10 || !obj || typeof obj !== 'object') return null;
                if (obj['@type'] === 'JobPosting') return obj;
                if (Array.isArray(obj['@graph'])) {
                    for (const item of obj['@graph']) {
                        const found = findJobPosting(item, depth + 1);
                        if (found) return found;
                    }
                }
                if (Array.isArray(obj)) {
                    for (const item of obj) {
                        const found = findJobPosting(item, depth + 1);
                        if (found) return found;
                    }
                }
                for (const key of Object.keys(obj)) {
                    if (typeof obj[key] === 'object') {
                        const found = findJobPosting(obj[key], depth + 1);
                        if (found) return found;
                    }
                }
                return null;
            };

            // Parse JSON-LD
            let jsonLd: any = {};
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.textContent || '{}');
                    const found = findJobPosting(json);
                    if (found) {
                        jsonLd = found;
                        break;
                    }
                } catch (e) { }
            }

            // Title
            const title = jsonLd.title ||
                getMeta(['og:title', 'twitter:title']) ||
                document.querySelector('h1')?.innerText?.trim() ||
                document.title?.split('|')[0]?.trim() ||
                'Unknown Job';

            // Company
            const company = jsonLd.hiringOrganization?.name ||
                getMeta(['og:site_name']) ||
                'Unknown Company';

            // Description - get raw HTML
            let rawHtml = '';
            let confidence_desc = 0;

            // Priority 1: JSON-LD
            if (jsonLd.description && jsonLd.description.length > 100) {
                rawHtml = jsonLd.description;
                confidence_desc = 0.95;
            }

            // Priority 2: Common selectors
            if (!rawHtml || rawHtml.length < 200) {
                const selectors = [
                    '[data-testid*="description"]',
                    '#job-description',
                    '.job-description',
                    '[class*="JobDescription"]',
                    '[class*="job-description"]',
                    'div[class*="description"]',
                    'article',
                    'main',
                ];

                for (const selector of selectors) {
                    const el = document.querySelector(selector);
                    if (el && el.innerHTML.length > (rawHtml?.length || 0)) {
                        rawHtml = el.innerHTML;
                        confidence_desc = 0.8;
                        if (rawHtml.length > 1000) break;
                    }
                }
            }

            // Priority 3: Text density fallback
            if (!rawHtml || rawHtml.length < 300) {
                let bestEl: HTMLElement | null = null;
                let bestScore = 0;

                document.querySelectorAll('div, section, article').forEach(el => {
                    const text = el.textContent || '';
                    const html = el.innerHTML || '';
                    const tagCount = (html.match(/<[^>]+>/g) || []).length;
                    const score = text.length / (1 + tagCount);

                    if (text.length > 300 && text.length < 20000 && score > bestScore) {
                        bestScore = score;
                        bestEl = el as HTMLElement;
                    }
                });

                if (bestEl && (bestEl as HTMLElement).innerHTML.length > (rawHtml?.length || 0)) {
                    rawHtml = (bestEl as HTMLElement).innerHTML;
                    confidence_desc = 0.6;
                }
            }

            // Date extraction
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
                const metaDate = getMeta(['date', 'article:published_time', 'publication_date']);
                if (metaDate) {
                    dateRaw = metaDate;
                    confidence_date = 0.8;
                }
            }

            if (!dateRaw) {
                // Look for relative text
                const relativeRegex = /(\d+|a|an)\s+(minute|hour|day|week|month)s?\s+ago/i;
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent?.trim();
                    if (text) {
                        const match = text.match(relativeRegex);
                        if (match) {
                            dateRaw = match[0];
                            confidence_date = 0.7;
                            break;
                        }
                    }
                }
            }

            if (!dateRaw) {
                const timeEl = document.querySelector('time');
                if (timeEl) {
                    dateRaw = timeEl.getAttribute('datetime') || timeEl.textContent?.trim() || '';
                    confidence_date = 0.75;
                }
            }

            // Location extraction
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
                const metaLoc = getMeta(['location', 'og:location']);
                if (metaLoc) {
                    location = metaLoc;
                    confidence_loc = 0.8;
                }
            }

            if (!location) {
                // Heuristic: look for city, state pattern
                const candidates = Array.from(document.querySelectorAll('span, div, p, li'))
                    .filter(el => {
                        const txt = el.textContent?.trim() || '';
                        return txt.length > 2 && txt.length < 50 &&
                            (/([A-Z][a-z]+),\s[A-Z]{2}/.test(txt) || /remote/i.test(txt));
                    });

                if (candidates.length > 0) {
                    location = candidates[0].textContent?.trim() || '';
                    confidence_loc = 0.6;
                }
            }

            if (!location) {
                location = 'Not found';
                confidence_loc = 0.1;
            }

            return {
                title,
                company,
                rawHtml: rawHtml || '',
                dateRaw: dateRaw || '',
                location,
                confidence: {
                    description: confidence_desc,
                    date: confidence_date,
                    location: confidence_loc
                }
            };
        });

        await browser.close();

        // Process extracted data - NO LENGTH LIMIT
        const jobDescriptionPlain = cleanHtmlToText(data.rawHtml);

        // Parse date
        let datePostedIso: string | null = null;
        let datePostedDisplay = 'Posted: Unknown';
        let datePostedRelative = false;

        if (data.dateRaw) {
            const parsed = parseRelativeDate(data.dateRaw);
            datePostedIso = parsed.iso;
            datePostedDisplay = parsed.display;
            datePostedRelative = parsed.isRelative;
        } else {
            // Default to scraped time
            datePostedIso = scrapedAt;
            datePostedDisplay = computeDateDisplay(scrapedAt);
        }

        return {
            title: data.title,
            company: data.company,
            source_url: url,
            source_host: sourceHost,
            raw_description_html: data.rawHtml,
            job_description_plain: jobDescriptionPlain,
            date_posted_iso: datePostedIso,
            date_posted_display: datePostedDisplay,
            date_posted_relative: datePostedRelative,
            location: data.location,
            scraped_at: scrapedAt,
            confidence: data.confidence
        };

    } catch (error) {
        await browser.close();
        throw error;
    }
}

/**
 * Auto-scroll to trigger lazy loading
 */
async function autoScroll(page: Page): Promise<void> {
    await page.evaluate(async () => {
        await new Promise<void>((resolve) => {
            let totalHeight = 0;
            const distance = 300;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                window.scrollBy(0, distance);
                totalHeight += distance;

                if (totalHeight >= scrollHeight || totalHeight > 5000) {
                    clearInterval(timer);
                    window.scrollTo(0, 0);
                    resolve();
                }
            }, 100);
        });
    });
}
