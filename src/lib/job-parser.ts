export interface JobParseResult {
    title: string;
    company: string;
    location: string | null;
    description: string;
    originalPostedDate: string | null;
    originalPostedRaw: string | null;
    originalPostedSource: string | null;
}

export function parseJobHtml(html: string, url: string): JobParseResult {
    // We need a DOM environment. In Node, we can use JSDOM, but we don't have it installed in dependencies?
    // Wait, the previous implementation ran inside Puppeteer's page.evaluate(), which has a full browser DOM.
    // If I move this to a shared library, I might lose access to `document`.
    // BUT! I can keep the logic stringified and inject it into Puppeteer, OR use a lightweight parser like cheerio/jsdom if available.
    // Looking at package.json, we don't have cheerio or jsdom. We have `html2canvas` (client) and `puppeteer`.
    // Using Puppeteer is heavy for a "unit test" if I just want to test logic.
    // 
    // HOWEVER, the user asked for unit tests.
    // If I want to unit test the LOGIC relying on `document.querySelector`, I need JSDOM or similar.
    // Since I can't add dependencies easily (user approval/network), I should stick to Puppeteer for the runtime.
    //
    // For the "Unit Test", I can use Puppeteer to load a local HTML string.
    //
    // So, `job-parser.ts` can export the FUNCTION that we pass to `page.evaluate`.
    // But `page.evaluate` takes a function that runs in browser context. It cannot close over variables easily unless passed as args.
    //
    // Let's define the function as a string or a standalone function we can pass.
    return {
        title: '', company: '', location: null, description: '', originalPostedDate: null, originalPostedRaw: null, originalPostedSource: null
    };
}

// Actually, defining the logic as a pure function that operates on `document` is the best way.
// We can test it by mocking `document` or running it in a headed-less browser test.
// Since `vitest` is set up, `vitest` often uses `jsdom` environment.
// Let's check `vitest.config.ts` or similar if it exists. If not, `package.json` says "test": "vitest run".
//
// If I assume `document` is available (via jsdom in tests), I can write the logic as a function accepting `Document`.

export function parseJobFromDocument(doc: Document): JobParseResult {
    // Helper to get meta content
    const getMeta = (names: string[]) => {
        for (const name of names) {
            const el = doc.querySelector(`meta[name="${name}"]`) || doc.querySelector(`meta[property="${name}"]`);
            const content = el?.getAttribute('content');
            if (content) return content;
        }
        return null;
    };

    // 1. JSON-LD Extraction
    let jsonLd: any = {};
    const scripts = doc.querySelectorAll('script[type="application/ld+json"]');
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
        doc.querySelector('h1')?.textContent?.trim() ||
        'Unknown Job';

    const company = jsonLd.hiringOrganization?.name ||
        getMeta(['og:site_name', 'twitter:site']) ||
        'Unknown Company';

    // 3. Description
    let description = jsonLd.description ||
        doc.querySelector('div[id*="job-description"]')?.innerHTML ||
        doc.querySelector('div[class*="description"]')?.innerHTML ||
        doc.querySelector('article')?.innerHTML ||
        doc.querySelector('main')?.innerText ||
        '';

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
        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
        let node;
        while (node = walker.nextNode()) {
            const text = node.textContent?.trim();
            if (text && locationKeywords.some(k => text.includes(k) && text.length < 50)) {
                const parentText = node.parentElement?.textContent?.trim(); // use textContent for JSDOM compatibility
                if (parentText && parentText.length < 100) {
                    const match = parentText.match(/(?:Location|City|Work arrangement)[:\s]+(.*?)(?:\n|$)/i);
                    if (match && match[1].trim().length > 2) {
                        locationDisplay = match[1].trim();
                        break;
                    }
                }
            }
        }
    }

    // Priority D: Heuristic Fallback
    if (!locationDisplay) {
        const potentialLocs = Array.from(doc.querySelectorAll('span, div, p, li'))
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

        const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
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
                const parentText = node.parentElement?.textContent?.trim();
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

    // Priority E: Time tag
    if (!originalPostedDate && !originalPostedRaw) {
        const timeEl = doc.querySelector('time');
        if (timeEl) {
            const dt = timeEl.getAttribute('datetime');
            if (dt) {
                originalPostedDate = dt;
                originalPostedRaw = dt;
                originalPostedSource = '<time> tag';
            } else {
                originalPostedRaw = timeEl.textContent?.trim() || null;
                originalPostedSource = '<time> text';
            }
        }
    }

    return {
        title: title || '',
        company: company || '',
        location: locationDisplay,
        description: description || '',
        originalPostedDate,
        originalPostedRaw,
        originalPostedSource
    };
}
