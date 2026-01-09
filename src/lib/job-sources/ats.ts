import { BaseJobSource, JobFilter, ScrapedJob } from './types';
import { cleanHtmlToText } from '../text-cleaner';

export class ATSAdapter extends BaseJobSource {
    // We will pass the specific ATS slug and provider type
    // This adapter is instantiated PER company, or can batch process.
    // For simplicity, let's make it fetch a list of target companies from config/DB.

    // In a real scenario, this list would come from the database 'ats_targets' table.
    // For now, we'll hardcode a few samples or allow injection.
    private targetCompanies: { name: string, provider: 'greenhouse' | 'lever', slug: string }[] = [
        // Examples: 
        { name: 'Figma', provider: 'lever', slug: 'figma' },
        { name: 'Vercel', provider: 'greenhouse', slug: 'vercel' },
        { name: 'Airbnb', provider: 'greenhouse', slug: 'airbnb' },
    ];

    constructor(targets?: { name: string, provider: 'greenhouse' | 'lever', slug: string }[]) {
        super('ats_aggregation');
        if (targets) this.targetCompanies = targets;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        const allJobs: ScrapedJob[] = [];

        // Check each company
        for (const company of this.targetCompanies) {
            try {
                let jobs: ScrapedJob[] = [];
                if (company.provider === 'greenhouse') {
                    jobs = await this.fetchGreenhouse(company);
                } else if (company.provider === 'lever') {
                    jobs = await this.fetchLever(company);
                }

                // Filter internally since ATS endpoints return everything
                const relevantJobs = this.filterJobsInMemory(jobs, filters);
                allJobs.push(...relevantJobs);

                await this.delay(500); // Politeness delay
            } catch (err) {
                console.error(`Failed to fetch ATS for ${company.name}:`, err);
            }
        }

        return allJobs;
    }

    private filterJobsInMemory(jobs: ScrapedJob[], filters: JobFilter): ScrapedJob[] {
        return jobs.filter(job => {
            const text = (job.title + ' ' + job.description).toLowerCase();

            // Check keywords (OR logic for list)
            // Actually usually we want AND for filters like "Software Engineer", but 
            // the requirements say "categories/keywords including". Let's assume ANY matches.
            const hasKeyword = filters.keywords.length === 0 || filters.keywords.some(k => text.includes(k.toLowerCase()));

            // Check level
            const hasLevel = !filters.level || filters.level.length === 0 ||
                filters.level.some(l => text.includes(l.toLowerCase()));

            return hasKeyword && hasLevel;
        });
    }

    private async fetchGreenhouse(company: { slug: string, name: string }): Promise<ScrapedJob[]> {
        // https://boards-api.greenhouse.io/v1/boards/{slug}/jobs?content=true
        const url = `https://boards-api.greenhouse.io/v1/boards/${company.slug}/jobs?content=true`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`Greenhouse ${res.status}`);

        const data = await res.json();
        const jobs = data.jobs || [];

        return jobs.map((j: any) => ({
            id: `gh-${j.id}`,
            title: j.title,
            company: company.name,
            location: j.location?.name || 'Remote',
            posted_at: j.updated_at, // Greenhouse gives updated_at usually
            source_url: j.absolute_url,
            description: cleanHtmlToText(j.content || ''), // Clean HTML content - NO LIMIT
            original_source: 'greenhouse',
            raw_source_data: j
        }));
    }

    private async fetchLever(company: { slug: string, name: string }): Promise<ScrapedJob[]> {
        // https://api.lever.co/v0/postings/{slug}?mode=json
        const url = `https://api.lever.co/v0/postings/${company.slug}?mode=json`;
        const res = await fetch(url, { next: { revalidate: 3600 } });
        if (!res.ok) throw new Error(`Lever ${res.status}`);

        const jobs = await res.json();

        return jobs.map((j: any) => ({
            id: `lv-${j.id}`,
            title: j.text,
            company: company.name,
            location: j.categories?.location || 'Remote',
            posted_at: j.createdAt, // specific to Lever
            source_url: j.hostedUrl,
            description: j.descriptionPlain || cleanHtmlToText(j.description || ''),
            original_source: 'lever',
            raw_source_data: j
        }));
    }
}
