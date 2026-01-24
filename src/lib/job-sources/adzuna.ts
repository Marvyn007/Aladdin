import { BaseJobSource, JobFilter, ScrapedJob } from './types';

export class AdzunaAdapter extends BaseJobSource {
    constructor() {
        super('adzuna', {
            appId: process.env.ADZUNA_APP_ID,
            apiKey: process.env.ADZUNA_API_KEY,
        });
    }

    isEnabled(): boolean {
        return !!(this.config.appId && this.config.apiKey);
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) {
            console.warn('Adzuna adapter missing keys, skipping.');
            return [];
        }

        try {
            const results: ScrapedJob[] = [];
            // Adzuna requires one keyword at a time or complex queries.
            // Iterate through ALL keywords now for maximum volume
            const keywords = filters.keywords.length > 0 ? filters.keywords : ['software engineer'];

            // Loop through ALL keywords
            for (const keyword of keywords) {
                // Fetch up to 3 pages for each keyword
                for (let page = 1; page <= 3; page++) {
                    console.log(`[Adzuna] Fetching '${keyword}' page ${page}...`);
                    const jobs = await this.fetchForKeyword(keyword, page, filters);
                    if (jobs.length === 0) break; // Stop pagination if no more results
                    results.push(...jobs);

                    // Mild delay to be nice to API
                    await this.delay(500);
                }
            }

            return results;
        } catch (error) {
            console.error('Adzuna fetch failed:', error);
            return []; // Fail gracefully
        }
    }

    private async fetchForKeyword(keyword: string, page: number, filters: JobFilter): Promise<ScrapedJob[]> {
        const country = 'us'; // api.adzuna.com/v1/api/jobs/us/search/1
        const what = encodeURIComponent(keyword + (filters.level?.includes('internship') ? ' intern' : ''));

        // Adzuna API URL
        // max_days_old: 1 if recent, else omit for all time
        const maxDaysParam = filters.recent ? '&max_days_old=1' : '';
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${this.config.appId}&app_key=${this.config.apiKey}&results_per_page=50&what=${what}${maxDaysParam}&sort_by=date&content-type=application/json`;

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            next: { revalidate: 0 } // No cache
        });

        if (!response.ok) {
            if (response.status === 429) {
                console.warn('Adzuna rate limit hit');
                return [];
            }
            throw new Error(`Adzuna API error: ${response.statusText}`);
        }

        const data = await response.json();

        // Normalize results
        return (data.results || []).map((item: any) => ({
            id: String(item.id),
            title: item.title,
            company: item.company?.display_name || 'Unknown',
            location: item.location?.display_name || 'US',
            posted_at: item.created ? new Date(item.created).toISOString() : null,
            source_url: item.redirect_url,
            description: item.description,
            salary: item.salary_min ? `$${item.salary_min} - $${item.salary_max}` : undefined,
            original_source: 'adzuna',
            raw_source_data: item
        }));
    }
}
