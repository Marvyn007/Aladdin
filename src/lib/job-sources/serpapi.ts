import { BaseJobSource, JobFilter, ScrapedJob } from './types';

export class SerpAPIAdapter extends BaseJobSource {
    constructor() {
        super('serpapi', { apiKey: process.env.SERPAPI_KEY });
    }

    isEnabled(): boolean {
        return !!this.config.apiKey;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];

        try {
            // Google Jobs via SerpAPI
            // q = query
            // tbs = time filter (qdr:d = past 24h)
            // location = United States

            const q = (filters.keywords || ['software engineer']).join(' ') +
                (filters.level?.includes('internship') ? ' intern' : '');

            const params = new URLSearchParams({
                api_key: this.config.apiKey!,
                engine: 'google_jobs',
                q: q,
                location: 'United States',
                google_domain: 'google.com',
                gl: 'us',
                hl: 'en',
                tbs: filters.recent ? 'qdr:d' : 'qdr:m' // Past 24 hours vs Past month
            });

            const url = `https://serpapi.com/search.json?${params.toString()}`;

            const response = await fetch(url, { next: { revalidate: 0 } });

            if (!response.ok) {
                console.warn(`SerpAPI error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            const jobs = data.jobs_results || [];

            return jobs.map((j: any) => ({
                id: j.job_id,
                title: j.title,
                company: j.company_name,
                location: j.location,
                posted_at: null, // SerpAPI often gives "10 hours ago" string extensions, handled by relative parser or just leave null (fresh by fetch time)
                source_url: j.share_link || (j.apply_options?.[0]?.link),
                description: j.description,
                original_source: 'serpapi',
                raw_source_data: j
            }));

        } catch (e) {
            console.error('SerpAPI fetch failed:', e);
            return [];
        }
    }
}
