import { BaseJobSource, JobFilter, ScrapedJob } from './types';

export class RapidAPIAdapter extends BaseJobSource {
    constructor() {
        super('rapidapi', { apiKey: process.env.RAPIDAPI_KEY });
    }

    isEnabled(): boolean {
        return !!this.config.apiKey;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];

        try {
            // Using JSearch API (one of the best on RapidAPI for jobs)
            // Host: jsearch.p.rapidapi.com
            const query = (filters.keywords || ['software engineer']).join(' ') +
                ' in United States' +
                (filters.level?.includes('internship') ? ' intern' : '');

            // date_posted: 'today' | '3days' | 'week' | 'month' | 'all'
            const datePosted = filters.recent ? 'today' : 'all';
            const params = new URLSearchParams({
                query: query,
                page: '1',
                num_pages: '10', // Fetch 10 pages (~100 jobs) at once
                date_posted: datePosted
            });

            const url = `https://jsearch.p.rapidapi.com/search?${params.toString()}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'X-RapidAPI-Key': this.config.apiKey!,
                    'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
                },
                next: { revalidate: 0 }
            });

            if (!response.ok) {
                console.warn(`RapidAPI (JSearch) error: ${response.status}`);
                return [];
            }

            const data = await response.json();
            const jobs = data.data || [];

            return jobs.map((j: any) => ({
                id: j.job_id,
                title: j.job_title,
                company: j.employer_name,
                location: j.job_country === 'US' ? (j.job_city ? `${j.job_city}, ${j.job_state}` : 'United States') : j.job_country,
                posted_at: j.job_posted_at_datetime_utc, // ISO string usually
                source_url: j.job_apply_link,
                description: j.job_description, // Full description often available
                original_source: 'rapidapi_jsearch',
                raw_source_data: j
            }));

        } catch (e) {
            console.error('RapidAPI fetch failed:', e);
            return [];
        }
    }
}
