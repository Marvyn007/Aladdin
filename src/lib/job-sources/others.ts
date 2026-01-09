import { BaseJobSource, JobFilter, ScrapedJob } from './types';

// ZipRecruiter Adapter Skeleton
export class ZipRecruiterAdapter extends BaseJobSource {
    constructor() {
        super('ziprecruiter', { apiKey: process.env.ZIPRECRUITER_KEY });
    }

    isEnabled(): boolean { return !!this.config.apiKey; }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];
        // Implementation for ZipRecruiter API would go here
        // Currently a placeholder
        return [];
    }
}

// Jooble Adapter Skeleton
export class JoobleAdapter extends BaseJobSource {
    constructor() {
        super('jooble', { apiKey: process.env.JOOBLE_KEY });
    }

    isEnabled(): boolean { return !!this.config.apiKey; }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];

        try {
            // Jooble is a POST request
            const url = `https://jooble.org/api/${this.config.apiKey}`;
            const keywords = filters.keywords.join(' ');

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keywords, location: 'United States' })
            });

            if (!response.ok) return [];
            const data = await response.json();

            return (data.jobs || []).map((j: any) => ({
                id: j.id, // Jooble ID
                title: j.title,
                company: j.company,
                location: j.location,
                posted_at: null, // Jooble often returns relative times "1 day ago"
                source_url: j.link,
                description: j.snippet,
                original_source: 'jooble',
                salary: j.salary
            }));

        } catch (e) {
            console.error('Jooble error:', e);
            return [];
        }
    }
}

// Careerjet Adapter Skeleton
export class CareerjetAdapter extends BaseJobSource {
    constructor() {
        super('careerjet', { apiKey: process.env.CAREERJET_KEY });
    }

    isEnabled(): boolean { return !!this.config.apiKey; }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];
        // Placeholder implementation
        return [];
    }
}
