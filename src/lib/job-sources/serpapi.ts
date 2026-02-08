import { BaseJobSource, JobFilter, ScrapedJob } from './types';
import { validateJobDescription } from '../job-validation';

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

            const results: ScrapedJob[] = [];

            // Loop for pagination (0, 10, 20, 30, 40) - 5 pages
            for (let start = 0; start < 50; start += 10) {
                console.log(`[SerpAPI] Fetching offset ${start}...`);
                const params = new URLSearchParams({
                    api_key: this.config.apiKey!,
                    engine: 'google_jobs',
                    q: q,
                    location: 'United States',
                    google_domain: 'google.com',
                    gl: 'us',
                    hl: 'en',
                    start: start.toString(),
                    ...(filters.recent ? { tbs: 'qdr:d' } : {})
                });

                const url = `https://serpapi.com/search.json?${params.toString()}`;
                const response = await fetch(url, { next: { revalidate: 0 } });

                if (!response.ok) {
                    console.warn(`SerpAPI error at offset ${start}: ${response.status}`);
                    break; // Stop if error
                }

                const data = await response.json();
                const jobs = data.jobs_results || [];

                if (jobs.length === 0) break; // Stop if no more jobs

                const mapped = jobs.map((j: any) => ({
                    id: j.job_id,
                    title: j.title,
                    company: j.company_name,
                    location: j.location,
                    posted_at: null,
                    source_url: j.share_link || (j.apply_options?.[0]?.link),
                    description: j.description,
                    original_source: 'serpapi',
                    raw_source_data: j
                }));

                const validJobs = mapped.filter((job: ScrapedJob) => {
                    const validation = validateJobDescription(job.description);
                    if (!validation.valid) {
                        console.warn(`[SerpAPI] Job rejected: ${job.title} - ${validation.reason}`);
                    }
                    return validation.valid;
                });

                results.push(...validJobs);
                await this.delay(500); // Mild delay
            }

            return results;

        } catch (e) {
            console.error('SerpAPI fetch failed:', e);
            return [];
        }
    }
}
