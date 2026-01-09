import { BaseJobSource, JobFilter, ScrapedJob } from './types';

export class JoobleAdapter extends BaseJobSource {
    constructor() {
        super('jooble', { apiKey: process.env.JOOBLE_KEY });
    }

    isEnabled(): boolean {
        return !!this.config.apiKey;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];

        try {
            // Jooble API: POST https://jooble.org/api/{key}
            const url = `https://jooble.org/api/${this.config.apiKey}`;

            // Construct query
            // Jooble doesn't have strict "last 24h" param in valid docs for free tier usually, 
            // but we can try to filter results or use date filters if supported.
            // We'll rely on keywords to narrow down.
            const keywords = (filters.keywords || ['software engineer']).join(' ') +
                (filters.level?.includes('internship') ? ' intern' : '');

            const body = {
                keywords: keywords,
                location: 'United States',
                resultOnPage: 50
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                next: { revalidate: 0 } // No cache for fresh jobs
            });

            if (!response.ok) {
                console.warn(`Jooble API error: ${response.status}`);
                return [];
            }

            const data = await response.json();

            // Jooble returns: { jobs: [ { title, location, snippet, salary, source, type, link, updated } ] }
            const jobs = data.jobs || [];

            // Filter for freshness locally
            // If recent=false, allow everything
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);

            return jobs
                .filter((j: any) => {
                    if (!this.config.apiKey) return false;
                    if (!filters.recent) return true; // Allow all if not strict
                    if (!j.updated) return true;
                    const posted = new Date(j.updated);
                    return posted >= oneDayAgo;
                })
                .map((j: any) => ({
                    id: String(j.id),
                    title: j.title,
                    company: j.company,
                    location: j.location,
                    posted_at: j.updated,
                    source_url: j.link,
                    description: j.snippet, // Jooble gives snippet
                    salary: j.salary,
                    original_source: 'jooble',
                    raw_source_data: j
                }));

        } catch (e) {
            console.error('Jooble fetch failed:', e);
            return [];
        }
    }
}
