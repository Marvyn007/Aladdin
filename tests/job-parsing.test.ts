import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import puppeteer, { Browser, Page } from 'puppeteer';

// Mock HTML for IBM
const ibmHtml = `
<!DOCTYPE html>
<html>
<head>
    <script type="application/ld+json">
    {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Senior Software Developer",
        "datePosted": "2025-12-01T08:00:00Z",
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Armonk",
                "addressRegion": "NY",
                "addressCountry": "US"
            }
        },
        "description": "Build cool things."
    }
    </script>
</head>
<body>
    <h1>Senior Software Developer</h1>
    <div class="job-details">
        <span>Location: Armonk, NY, US</span>
        <span>Posted: Dec 01, 2025</span>
    </div>
</body>
</html>
`;

// Mock HTML for LinkedIn (Meta tag based)
const linkedinHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta name="title" content="Frontend Engineer">
    <meta property="og:site_name" content="LinkedIn">
    <meta name="date" content="2025-11-20">
    <meta name="location" content="San Francisco, CA">
</head>
<body>
    <h1>Frontend Engineer</h1>
    <span class="posted-time">Posted 2 weeks ago</span>
</body>
</html>
`;

// Mock HTML for Generic Site (Visible text based)
const genericHtml = `
<!DOCTYPE html>
<html>
<body>
    <h1>Marketing Manager</h1>
    <div class="sidebar">
        <p><strong>Location:</strong> Austin, Texas (Remote)</p>
        <p><strong>Date:</strong> 3 days ago</p>
    </div>
</body>
</html>
`;

describe('Job Parsing Logic', () => {
    let browser: Browser;
    let page: Page;

    beforeAll(async () => {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox']
        });
        page = await browser.newPage();
    });

    afterAll(async () => {
        await browser.close();
    });

    // The parsing logic from route.ts
    const parsePage = async () => {
        return await page.evaluate(() => {
            // Helper to get meta content
            const getMeta = (names: string[]) => {
                for (const name of names) {
                    const el = document.querySelector(`meta[name="${name}"]`) || document.querySelector(`meta[property="${name}"]`);
                    const content = el?.getAttribute('content');
                    if (content) return content;
                }
                return null;
            };

            // 1. JSON-LD Extraction
            let jsonLd: any = {};
            const scripts = document.querySelectorAll('script[type="application/ld+json"]');
            for (const script of scripts) {
                try {
                    const json = JSON.parse(script.textContent || '{}');
                    if (json['@type'] === 'JobPosting') {
                        jsonLd = json;
                        break;
                    }
                } catch (e) { }
            }

            // 2. Title & Company
            const title = jsonLd.title ||
                getMeta(['og:title', 'twitter:title']) ||
                document.querySelector('h1')?.innerText?.trim() ||
                'Unknown Job';

            const company = jsonLd.hiringOrganization?.name ||
                getMeta(['og:site_name', 'twitter:site']) ||
                'Unknown Company';

            // 4. Location Extraction
            let locationDisplay: string | null = null;

            // Priority A: JSON-LD
            if (jsonLd.jobLocationType === 'TELECOMMUTE') {
                locationDisplay = 'Remote';
            } else if (jsonLd.jobLocation?.address) {
                const addr = jsonLd.jobLocation.address;
                if (typeof addr === 'string') {
                    locationDisplay = addr;
                } else if (addr.addressLocality) {
                    const parts = [addr.addressLocality, addr.addressRegion, addr.addressCountry].filter(Boolean);
                    locationDisplay = parts.join(', ');
                }
            }

            // Priority B: Meta tags
            if (!locationDisplay) {
                locationDisplay = getMeta(['location', 'og:location', 'place:location:latitude']);
                if (!locationDisplay) locationDisplay = getMeta(['job.location', 'twitter:data2']);
            }

            // Priority C: Visible Labels
            if (!locationDisplay) {
                const locationKeywords = ['Location', 'City', 'Work arrangement'];
                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent?.trim();
                    if (text && locationKeywords.some(k => text.includes(k) && text.length < 50)) {
                        // Check parent
                        let parentText = node.parentElement?.innerText?.trim();
                        let match = parentText?.match(/(?:Location|City|Work arrangement)[:\s]+(.*?)(?:\n|$)/i);

                        // If not found or too short, check grandparent (e.g. <p><strong>Location:</strong> NY</p>)
                        if ((!match || !match[1] || match[1].trim().length < 2) && node.parentElement?.parentElement) {
                            parentText = node.parentElement.parentElement.innerText?.trim();
                            match = parentText?.match(/(?:Location|City|Work arrangement)[:\s]+(.*?)(?:\n|$)/i);
                        }

                        if (match && match[1].trim().length > 2) {
                            locationDisplay = match[1].trim();
                            break;
                        }
                    }
                }
            }

            // Priority D: Heuristic Fallback
            if (!locationDisplay) {
                const potentialLocs = Array.from(document.querySelectorAll('span, div, p, li'))
                    .filter(el => {
                        const txt = el.textContent?.trim() || '';
                        return txt.length > 2 && txt.length < 40 &&
                            /^[A-Z]/.test(txt) &&
                            (txt.includes(',') || txt.includes('Remote') || txt.includes('Hybrid'));
                    });

                const bestCandidate = potentialLocs.find(el => /([A-Z][a-z]+),\s[A-Z]{2}/.test(el.textContent || ''));
                if (bestCandidate) locationDisplay = bestCandidate.textContent?.trim() || null;
            }

            if (!locationDisplay) locationDisplay = 'Location not specified';


            // 5. Posted Date Extraction
            let originalPostedDate: string | null = null;
            let originalPostedRaw: string | null = null;
            let originalPostedSource: string | null = null;

            // Priority A: JSON-LD
            if (jsonLd.datePosted || jsonLd.datePublished) {
                originalPostedDate = jsonLd.datePosted || jsonLd.datePublished;
                originalPostedRaw = originalPostedDate;
                originalPostedSource = 'schema.org/JobPosting';
            }

            // Priority B: Meta tags
            if (!originalPostedDate) {
                const metaDate = getMeta(['date', 'article:published_time', 'publication_date', 'posted', 'og:updated_time']);
                if (metaDate) {
                    originalPostedDate = metaDate;
                    originalPostedRaw = metaDate;
                    originalPostedSource = 'meta tag';
                }
            }

            // Priority C & D: Visible Labels & Relative Strings
            if (!originalPostedDate) {
                const relativeRegex = /(\d+|a|an)\s+(minute|hour|day|week|month)s?\s+ago/i;
                const postedKeywords = ['Posted', 'Published', 'Date', 'Added'];

                const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
                let node;
                while (node = walker.nextNode()) {
                    const text = node.textContent?.trim();
                    if (!text) continue;

                    const relMatch = text.match(relativeRegex);
                    if (relMatch) {
                        originalPostedRaw = relMatch[0];
                        originalPostedSource = 'relative text';
                        break;
                    }

                    if (postedKeywords.some(k => text.includes(k))) {
                        const parentText = node.parentElement?.innerText?.trim();
                        if (parentText && parentText.length < 100) {
                            const dateMatch = parentText.match(/(\d{4}-\d{2}-\d{2})|(\d{1,2}\/\d{1,2}\/\d{4})|([A-Z][a-z]{2}\s\d{1,2},?\s\d{4})/);
                            if (dateMatch) {
                                originalPostedRaw = dateMatch[0];
                                originalPostedSource = 'visible date text';
                                break;
                            }
                        }
                    }
                }
            }

            return {
                title,
                location: locationDisplay,
                originalPostedDate,
                originalPostedRaw,
                originalPostedSource
            };
        });
    };

    it('should parse IBM job correctly (JSON-LD priority)', async () => {
        await page.setContent(ibmHtml);
        const result = await parsePage();

        expect(result.originalPostedDate).toBe('2025-12-01T08:00:00Z');
        expect(result.location).toBe('Armonk, NY, US');
        expect(result.originalPostedSource).toBe('schema.org/JobPosting');
    });

    it('should parse LinkedIn job correctly (Meta tags priority)', async () => {
        await page.setContent(linkedinHtml);
        const result = await parsePage();

        expect(result.originalPostedDate).toBe('2025-11-20');
        expect(result.location).toBe('San Francisco, CA');
        expect(result.originalPostedSource).toBe('meta tag');
    });

    it('should parse Generic job correctly (Visible text heuristics)', async () => {
        await page.setContent(genericHtml);
        const result = await parsePage();

        expect(result.originalPostedRaw).toBe('3 days ago'); // Relative text
        expect(result.location).toBe('Austin, Texas (Remote)');
        expect(result.originalPostedSource).toBe('relative text');
    });
});
