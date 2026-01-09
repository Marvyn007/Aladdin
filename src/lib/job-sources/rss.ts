import Parser from 'rss-parser';
import { BaseJobSource, JobFilter, ScrapedJob } from './types';
import { generateContentHash } from '../db';
import { cleanHtmlToText } from '../text-cleaner';
import { v4 as uuidv4 } from 'uuid';

const FEEDS = [
    { url: 'https://remoteok.com/remote-dev-jobs.rss', name: 'RemoteOK', priority: 1 },
    { url: 'https://weworkremotely.com/categories/remote-programming-jobs.rss', name: 'WeWorkRemotely', priority: 1 },
    { url: 'https://remotive.com/remote-jobs/software-dev/rss', name: 'Remotive', priority: 1 },
    { url: 'https://hnrss.org/jobs?q=hiring', name: 'Hacker News', priority: 2 } // "Who is hiring" search
];

const KEYWORDS_REQUIRED = ['software', 'engineer', 'developer', 'full stack', 'frontend', 'backend', 'web', 'react', 'node', 'typescript', 'javascript', 'python', 'java', 'go', 'rust'];
const KEYWORDS_NEGATIVE = ['senior', 'principal', 'staff', 'lead', 'manager', 'architect', 'head of', 'sr.', 'iii', 'iv'];
const LOCATION_PATTERNS_ALLOW = [/remote/i, /united states/i, /usa/i, /us\b/i, /america/i, /anywhere/i];
const LOCATION_PATTERNS_REJECT = [/europe/i, /uk/i, /london/i, /canada/i, /germany/i, /france/i, /australia/i, /india/i, /brazil/i];

export class RSSAdapter extends BaseJobSource {
    private parser: Parser;

    constructor() {
        super('RSS Feeds');
        this.parser = new Parser();
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        console.log(`[RSS] Fetching from ${FEEDS.length} feeds...`);
        const results: ScrapedJob[] = [];

        // Run all feeds in parallel
        const feedPromises = FEEDS.map(async (feed) => {
            try {
                const parsed = await this.parser.parseURL(feed.url);
                let count = 0;

                parsed.items.forEach(item => {
                    if (!item.title || !item.link) return;

                    // 1. Keyword Filter (Role)
                    const titleLower = item.title.toLowerCase();
                    const hasKeyword = KEYWORDS_REQUIRED.some(k => titleLower.includes(k));
                    if (!hasKeyword) return;

                    // 2. Negative Filter (Level) - unless filters.level is empty/broad
                    if (filters.recent) {
                        const isSenior = KEYWORDS_NEGATIVE.some(k => titleLower.includes(k));
                        if (isSenior) return;
                    }

                    // 3. Location Filter
                    const fullText = (item.title + ' ' + (item.contentSnippet || item.content || '')).toLowerCase();

                    const isRemote = /remote/i.test(fullText);
                    const isUS = LOCATION_PATTERNS_ALLOW.some(p => p.test(fullText));
                    const isForeign = LOCATION_PATTERNS_REJECT.some(p => p.test(fullText));

                    if (isForeign && !isUS) return; // Explicitly foreign
                    if (!isRemote && !isUS) return; // ambiguous/unknown location -> Skip to be safe

                    // 4. Date Filter
                    let postedAt = new Date().toISOString();
                    if (item.isoDate) postedAt = item.isoDate;
                    else if (item.pubDate) postedAt = new Date(item.pubDate).toISOString();
                    else postedAt = null as any; // Allow null, but type says string|null. let's assign null if invalid.

                    if (!postedAt || postedAt === 'Invalid Date') postedAt = null as any;

                    if (postedAt && filters.recent) {
                        const posted = new Date(postedAt);
                        const diffHours = (Date.now() - posted.getTime()) / (1000 * 60 * 60);
                        if (diffHours > 24) return;
                    }

                    // Normalize and clean description - NO LENGTH LIMIT
                    const rawDescription = item.content || item.contentSnippet || item.summary || '';
                    const description = cleanHtmlToText(rawDescription);
                    // HNRSS often format: "Company is hiring Role"
                    const companyMatch = item.title.match(/^(.*?)(?: is hiring| hiring| at )/i);
                    // RemoteOK often format: "Role at Company" or "Company is hiring Role". 
                    // Actually RemoteOK is "Role at Company". 
                    // Let's try heuristic: " at " split.

                    let company = 'Unknown';
                    let cleanTitle = item.title;

                    if (item.title.includes(' at ')) {
                        const parts = item.title.split(' at ');
                        cleanTitle = parts[0].trim();
                        company = parts[1].trim();
                    } else if (companyMatch) {
                        company = companyMatch[1].trim();
                        cleanTitle = item.title.replace(/^(.*?)(?: is hiring| hiring )/i, '').trim();
                    } else if (feed.name === 'Hacker News') {
                        company = 'Hacker News';
                    }

                    const contentHash = generateContentHash(cleanTitle, company, isRemote ? 'Remote' : 'United States', description);

                    results.push({
                        id: uuidv4(),
                        title: cleanTitle,
                        company: company,
                        location: isRemote ? 'Remote' : 'United States',
                        source_url: item.link || '',
                        posted_at: postedAt,
                        description: description, // Used for 'normalized_text' mapping later
                        original_source: feed.name.toLowerCase().replace(' ', ''),
                        raw_source_data: item
                    });
                    count++;
                });

                console.log(`[RSS] ${feed.name}: Found ${count} matching jobs`);
            } catch (err) {
                console.error(`[RSS] Failed to fetch ${feed.name}:`, err);
            }
        });

        await Promise.all(feedPromises);
        return results;
    }
}
