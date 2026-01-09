import { AdzunaAdapter } from './adzuna';
import { USAJobsAdapter } from './usajobs';
import { JoobleAdapter } from './jooble';
import { RapidAPIAdapter } from './rapidapi';
import { SerpAPIAdapter } from './serpapi';
import { RSSAdapter } from './rss';
import { ATSAdapter } from './ats';
import { JobFilter, ScrapedJob, JobSourceAdapter } from './types';

// === CURATED SWE ROLE WHITELIST ===
// Job title MUST contain at least one of these EXACT phrases
// This is the definitive list - quality over quantity
const SWE_WHITELIST = [
    // Core SWE titles
    'software engineer',
    'software developer',
    'software development engineer',
    'swe intern',
    'sde intern',

    // Full Stack
    'full stack',
    'fullstack',
    'full-stack',

    // Frontend
    'frontend',
    'front-end',
    'front end',
    'ui engineer',
    'ui developer',

    // Backend
    'backend',
    'back-end',
    'back end',
    'api developer',
    'api engineer',

    // Web
    'web developer',
    'web engineer',

    // Mobile
    'mobile developer',
    'mobile engineer',
    'ios developer',
    'ios engineer',
    'android developer',
    'android engineer',

    // Language-specific (with developer/engineer suffix implied)
    'react developer',
    'react engineer',
    'node developer',
    'node engineer',
    'python developer',
    'python engineer',
    'java developer',
    'java engineer',
    'javascript developer',
    'typescript developer',
    '.net developer',
    'golang developer',
    'go developer',
    'rust developer',
    'c++ developer',

    // Cloud/DevOps (still SWE adjacent)
    'cloud engineer',
    'devops engineer',
    'platform engineer',
    'site reliability engineer',
    'sre',

    // Data/ML (coding-heavy)
    'machine learning engineer',
    'ml engineer',
    'data engineer',

    // Quant/Finance Tech
    'quant developer',
    'quantitative developer',
    'quant engineer',
    'trading systems',

    // Application
    'application developer',
    'applications engineer',
];

// IMMEDIATE DISQUALIFIERS - reject even if whitelist matches
const BLACKLIST = [
    // Seniority
    'senior', 'sr.', 'sr ', 'principal', 'staff', 'lead', 'manager',
    'architect', 'director', 'head of', 'vp ', 'vice president',
    'ii', 'iii', 'iv', 'level 2', 'level 3', 'level 4', 'level 5',
    'mid-level', 'mid level', 'experienced',
    '3+ years', '4+ years', '5+ years', '6+ years', '7+ years',
    '3 years', '4 years', '5 years',

    // Non-SWE roles that might sneak in
    'security engineer', 'security analyst', 'cybersecurity',
    'product security', 'information security',
    'gnc', 'guidance navigation',
    'systems engineer', 'system engineer',
    'test engineer', 'qa engineer', 'quality assurance',
    'hardware engineer', 'electrical engineer', 'mechanical engineer',
    'network engineer', 'network administrator',
    'data analyst', 'business analyst',
    'project manager', 'product manager',
    'sales engineer', 'solutions engineer', 'support engineer',
    'site engineer', 'field engineer',
    'civil engineer', 'structural engineer', 'aerospace engineer',
    'rf engineer', 'firmware engineer',
    'control engineer', 'controls engineer',
    'validation engineer', 'verification engineer',
    'manufacturing engineer', 'process engineer',
];

// VISA SPONSORSHIP KEYWORDS - jobs with these get priority
const VISA_POSITIVE_KEYWORDS = [
    'opt', 'cpt', 'h1b', 'h-1b', 'visa sponsor', 'sponsorship available',
    'will sponsor', 'sponsors visa', 'stem opt', 'work authorization',
    'international students', 'all candidates welcome',
];

// US location patterns
const US_LOCATION_PATTERNS = [
    /united states/i, /\busa\b/i, /\bus\b/i, /america/i,
    /new york/i, /\bny\b/i, /california/i, /\bca\b/i, /texas/i, /\btx\b/i,
    /seattle/i, /\bwa\b/i, /florida/i, /\bfl\b/i, /illinois/i, /\bil\b/i,
    /san francisco/i, /los angeles/i, /chicago/i, /boston/i, /austin/i,
    /denver/i, /atlanta/i, /phoenix/i, /miami/i
];

const FOREIGN_PATTERNS = [
    /europe/i, /\buk\b/i, /united kingdom/i, /london/i, /canada/i,
    /germany/i, /france/i, /australia/i, /india/i, /brazil/i,
    /berlin/i, /paris/i, /toronto/i, /mumbai/i, /bangalore/i,
    /netherlands/i, /ireland/i, /spain/i, /italy/i, /poland/i
];

export class JobSourceCoordinator {
    private adapters: JobSourceAdapter[];

    constructor() {
        this.adapters = [
            new AdzunaAdapter(),
            new JoobleAdapter(),
            new RapidAPIAdapter(),
            new SerpAPIAdapter(),
            new RSSAdapter(),
            new USAJobsAdapter(),
            new ATSAdapter()
        ];
    }

    async fetchAllJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        console.log('=== CURATED SWE JOB FETCH (Visa Priority) ===');

        // Log adapter status
        console.log('\n[Job Sources] Checking adapter configurations:');
        this.adapters.forEach(a => {
            const enabled = a.isEnabled();
            const status = enabled ? '✓ ENABLED' : '✗ DISABLED (missing API key)';
            console.log(`  ${a.sourceName}: ${status}`);
        });

        const allResults: ScrapedJob[] = [];
        const activeAdapters = this.adapters.filter(a => a.isEnabled());

        if (activeAdapters.length === 0) {
            console.error('\n[Job Sources] ⚠️  NO ADAPTERS ARE ENABLED!');
            console.error('[Job Sources] You need to configure at least one job source API key in .env.local:');
            console.error('  - RAPIDAPI_KEY (RapidAPI JSearch)');
            console.error('  - ADZUNA_APP_ID + ADZUNA_API_KEY');
            console.error('  - JOOBLE_KEY');
            console.error('  - SERPAPI_KEY');
            console.error('  - USAJOBS_API_KEY');
            return [];
        }

        console.log(`\n[Job Sources] Active adapters: ${activeAdapters.map(a => a.sourceName).join(', ')}`);
        console.log('[Job Sources] Fetching jobs from all active sources...\n');

        const results = await Promise.allSettled(
            activeAdapters.map(async (adapter) => {
                const start = Date.now();
                try {
                    console.log(`[${adapter.sourceName}] Fetching...`);
                    const jobs = await adapter.fetchJobs(filters);
                    console.log(`[${adapter.sourceName}] ✓ Fetched ${jobs.length} jobs in ${Date.now() - start}ms`);
                    return jobs;
                } catch (error) {
                    console.error(`[${adapter.sourceName}] ✗ Error:`, error);
                    return [];
                }
            })
        );

        results.forEach(result => {
            if (result.status === 'fulfilled') {
                allResults.push(...result.value);
            }
        });

        console.log(`\n[Job Sources] Total raw jobs: ${allResults.length}`);

        const deduped = this.deduplicate(allResults);
        console.log(`After dedup: ${deduped.length}`);

        const filtered = this.applyStrictFilters(deduped);
        console.log(`After strict filter: ${filtered.length}`);

        // Sort: Visa-friendly jobs first
        const sorted = this.sortByVisaPriority(filtered);
        console.log(`=== FINAL: ${sorted.length} curated SWE jobs ===`);

        return sorted;
    }

    private deduplicate(jobs: ScrapedJob[]): ScrapedJob[] {
        const seen = new Set<string>();
        return jobs.filter(job => {
            if (!job.title || !job.source_url) return false;
            const key = `${(job.company || '').toLowerCase()}-${job.title.toLowerCase()}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    private applyStrictFilters(jobs: ScrapedJob[]): ScrapedJob[] {
        const now = Date.now();
        const ONE_DAY_MS = 24 * 60 * 60 * 1000;

        let stats = { whitelist: 0, blacklist: 0, location: 0, date: 0 };

        const filtered = jobs.filter(job => {
            const titleLower = job.title.toLowerCase();
            const locationLower = (job.location || '').toLowerCase();
            const descLower = (job.description || '').toLowerCase();

            // RULE 1: MUST match whitelist
            const matchesWhitelist = SWE_WHITELIST.some(term => titleLower.includes(term));
            if (!matchesWhitelist) {
                stats.whitelist++;
                return false;
            }

            // RULE 2: MUST NOT match blacklist
            const matchesBlacklist = BLACKLIST.some(term => titleLower.includes(term));
            if (matchesBlacklist) {
                console.log(`BLOCKED: "${job.title}" (blacklist match)`);
                stats.blacklist++;
                return false;
            }

            // RULE 3: US location only
            const isForeign = FOREIGN_PATTERNS.some(p => p.test(locationLower));
            if (isForeign) {
                stats.location++;
                return false;
            }
            const isUS = US_LOCATION_PATTERNS.some(p => p.test(locationLower));
            const isRemote = /remote/i.test(locationLower);
            if (!isUS && !isRemote) {
                stats.location++;
                return false;
            }

            // RULE 4: Posted within 24h
            if (!job.posted_at) {
                stats.date++;
                return false;
            }
            const posted = new Date(job.posted_at).getTime();
            if (isNaN(posted) || (now - posted) > ONE_DAY_MS) {
                stats.date++;
                return false;
            }

            return true;
        });

        console.log(`Filter stats: whitelist=${stats.whitelist}, blacklist=${stats.blacklist}, location=${stats.location}, date=${stats.date}`);
        return filtered;
    }

    private sortByVisaPriority(jobs: ScrapedJob[]): ScrapedJob[] {
        return jobs.sort((a, b) => {
            const aText = `${a.title} ${a.description || ''}`.toLowerCase();
            const bText = `${b.title} ${b.description || ''}`.toLowerCase();

            const aVisa = VISA_POSITIVE_KEYWORDS.some(kw => aText.includes(kw));
            const bVisa = VISA_POSITIVE_KEYWORDS.some(kw => bText.includes(kw));

            if (aVisa && !bVisa) return -1; // a first
            if (!aVisa && bVisa) return 1;  // b first
            return 0; // keep original order
        });
    }
}
