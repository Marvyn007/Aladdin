export interface JobSourceConfig {
    apiKey?: string;
    appId?: string; // Specific to Adzuna
    baseUrl?: string;
}

export interface JobFilter {
    recent: boolean; // within 24h
    keywords: string[];
    level?: string[]; // 'internship', 'entry_level'
    location?: string; // 'us'
    limit?: number;
}

export interface ScrapedJob {
    id: string; // Unique ID from source
    title: string;
    company: string;
    location: string;
    posted_at: string | null; // ISO string or null
    source_url: string;
    description: string; // Snippet or full text
    salary?: string;
    raw_source_data?: any;
    original_source: string; // 'adzuna', 'usajobs', etc.
}

export interface JobSourceAdapter {
    sourceName: string;
    isEnabled(): boolean;
    fetchJobs(filters: JobFilter): Promise<ScrapedJob[]>;
}

export class BaseJobSource implements JobSourceAdapter {
    sourceName: string;
    protected config: JobSourceConfig;

    constructor(name: string, config: JobSourceConfig = {}) {
        this.sourceName = name;
        this.config = config;
    }

    isEnabled(): boolean {
        // Default check: if API key is required, check if it exists
        // Subclasses can override
        return true;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        throw new Error('fetchJobs must be implemented by subclass');
    }

    protected async delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
