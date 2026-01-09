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
            // We'll iterate through main "role" keywords
            const keywords = filters.keywords.length > 0 ? filters.keywords : ['software engineer'];

            // Limit calls to avoid rate limits (loop max 3 keywords)
            const searchKeywords = keywords.slice(0, 3);

            for (const keyword of searchKeywords) {
                const jobs = await this.fetchForKeyword(keyword, filters);
                results.push(...jobs);
                // Mild delay between keywords
                await this.delay(1000);
            }

            return results;
        } catch (error) {
            console.error('Adzuna fetch failed:', error);
            return []; // Fail gracefully
        }
    }

    private async fetchForKeyword(keyword: string, filters: JobFilter): Promise<ScrapedJob[]> {
        const country = 'us'; // api.adzuna.com/v1/api/jobs/us/search/1
        const page = 1;
        const what = encodeURIComponent(keyword + (filters.level?.includes('internship') ? ' intern' : ''));

        // Adzuna API URL
        // max_days_old: 1 if recent, else 30
        const maxDays = filters.recent ? 1 : 30;
        const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/${page}?app_id=${this.config.appId}&app_key=${this.config.apiKey}&results_per_page=50&what=${what}&max_days_old=${maxDays}&sort_by=date&content-type=application/json`;

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
