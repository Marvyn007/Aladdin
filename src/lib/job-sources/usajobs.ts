import { BaseJobSource, JobFilter, ScrapedJob } from './types';
import { validateJobDescription } from '../job-validation';

export class USAJobsAdapter extends BaseJobSource {
    constructor() {
        super('usajobs', {
            apiKey: process.env.USAJOBS_API_KEY,
        });
    }

    isEnabled(): boolean {
        return !!this.config.apiKey;
    }

    async fetchJobs(filters: JobFilter): Promise<ScrapedJob[]> {
        if (!this.isEnabled()) return [];

        try {
            const keywords = filters.keywords.length > 0 ? filters.keywords.join(' ') : 'software engineer';

            // USAJOBS API Search
            // Host: data.usajobs.gov
            // User-Agent: strict requirement (email usually)
            const host = 'data.usajobs.gov';
            const userAgent = 'job-hunt-vibe-bot/1.0';

            const results: ScrapedJob[] = [];

            // Loop pages 1 to 4 (200 jobs max)
            for (let page = 1; page <= 4; page++) {
                console.log(`[USAJOBS] Fetching page ${page}...`);
                const url = `https://${host}/api/search?Keyword=${encodeURIComponent(keywords)}&PositionSensitivity=Low&ResultsPerPage=50&Page=${page}`;

                const response = await fetch(url, {
                    headers: {
                        'Host': host,
                        'User-Agent': userAgent,
                        'Authorization-Key': this.config.apiKey || ''
                    },
                    next: { revalidate: 3600 }
                });

                if (!response.ok) {
                    console.warn(`USAJOBS API error on page ${page}: ${response.status} ${response.statusText}`);
                    break;
                }

                const data = await response.json();
                const items = data.SearchResult?.SearchResultItems || [];

                if (items.length === 0) break;

                const mapped = items.map((item: any) => {
                    const desc = item.MatchedObjectDescriptor;
                    return {
                        id: String(desc.PositionID),
                        title: desc.PositionTitle,
                        company: desc.OrganizationName,
                        location: desc.PositionLocation?.[0]?.LocationName || 'US',
                        posted_at: desc.PublicationStartDate,
                        source_url: desc.PositionURI,
                        description: desc.UserArea?.Details?.JobSummary || desc.Description,
                        salary: desc.PositionRemuneration?.[0]?.MinimumRange ?
                            `$${desc.PositionRemuneration[0].MinimumRange} - $${desc.PositionRemuneration[0].MaximumRange}` : undefined,
                        original_source: 'usajobs',
                        raw_source_data: item
                    };
                });

                const validJobs = mapped.filter((job: ScrapedJob) => {
                    const validation = validateJobDescription(job.description);
                    if (!validation.valid) {
                        console.warn(`[USAJobs] Job rejected: ${job.title} - ${validation.reason}`);
                    }
                    return validation.valid;
                });

                results.push(...validJobs);
                await this.delay(500);
            }

            return results;

        } catch (error) {
            console.error('USAJOBS fetch failed:', error);
            return [];
        }
    }
}
