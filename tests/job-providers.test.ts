import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GreenhouseAdapter } from '../src/lib/job-sources/adapters/greenhouse';
import { ArbeitnowAdapter } from '../src/lib/job-sources/adapters/arbeitnow';

// Mock global fetch
const fetchMock = vi.fn();
global.fetch = fetchMock as any;

describe('GreenhouseAdapter', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    it('should use ?content=true to fetch descriptions', async () => {
        const mockResponse = {
            jobs: [
                {
                    absolute_url: 'https://boards.greenhouse.io/test/jobs/123',
                    internal_job_id: 123,
                    location: { name: 'Remote' },
                    title: 'Software Engineer',
                    updated_at: '2025-01-01T00:00:00Z',
                    content: '&lt;h1&gt;Job Description&lt;/h1&gt;&lt;p&gt;We are looking for a software engineer. Minimum requirement is lots of coding and problem solving skills ... (simulated long description length 100+ chars)...&lt;/p&gt;'
                }
            ]
        };

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const adapter = new GreenhouseAdapter();
        const jobs = await adapter.poll({ type: 'company', slug: 'test' });

        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('?content=true'),
            expect.any(Object)
        );

        expect(jobs).toHaveLength(1);
        expect(jobs[0].rawDescriptionHtml).toContain('Job Description');
        expect(jobs[0].jobDescriptionPlain).toContain('We are looking for a software engineer');
    });
});

describe('ArbeitnowAdapter', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    it('should filter out German descriptions', async () => {
        const mockResponse = {
            data: [
                {
                    slug: 'english-job',
                    company_name: 'Tech Inc',
                    title: 'English Developer',
                    description: '&lt;p&gt;This is an English job description with sufficient length to be considered valid.&lt;/p&gt;',
                    location: 'Berlin',
                    remote: true,
                    url: 'https://arbeitnow.com/english-job',
                    created_at: 1700000000
                },
                {
                    slug: 'german-job',
                    company_name: 'Tech GmbH',
                    title: 'German Developer',
                    description: '&lt;p&gt;Wir suchen einen Entwickler für unser Team. Die Arbeit ist sehr gut und wir bieten viel.&lt;/p&gt;',
                    location: 'Munich',
                    remote: false,
                    url: 'https://arbeitnow.com/german-job',
                    created_at: 1700000000
                }
            ]
        };

        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => mockResponse,
        });

        const adapter = new ArbeitnowAdapter();
        const jobs = await adapter.poll({ type: 'bulk', page: 1 });

        // Should only return the English job
        expect(jobs).toHaveLength(1);
        expect(jobs[0].title).toBe('English Developer');
    });
});

import { WorkdayAdapter } from '../src/lib/job-sources/adapters/workday';

describe('WorkdayAdapter', () => {
    beforeEach(() => {
        fetchMock.mockClear();
    });

    it('should query list endpoint and then fetch details for jobs', async () => {
        // Mock list response
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                jobPostings: [
                    { title: 'Engineer', externalPath: '/job/123' }
                ]
            })
        });

        // Mock detail response
        fetchMock.mockResolvedValueOnce({
            ok: true,
            json: async () => ({
                jobPostingInfo: {
                    title: 'Engineer',
                    jobDescription: '<p>A workday description</p>'
                }
            })
        });

        const adapter = new WorkdayAdapter();
        const jobs = await adapter.poll({ type: 'company', slug: 'test.wd1.example.com::TestTenant' });

        expect(fetchMock).toHaveBeenCalledTimes(2);
        
        // Ensure POST to jobs list endpoint
        expect(fetchMock.mock.calls[0][0]).toContain('/wday/cxs/TestTenant/jobs');
        expect(fetchMock.mock.calls[0][1].method).toBe('POST');
        
        // Ensure GET to job detail endpoint
        expect(fetchMock.mock.calls[1][0]).toContain('/wday/cxs/TestTenant/job/123');

        expect(jobs).toHaveLength(1);
        expect(jobs[0].title).toBe('Engineer');
        expect(jobs[0].rawDescriptionHtml).toBe('<p>A workday description</p>');
    });
});
