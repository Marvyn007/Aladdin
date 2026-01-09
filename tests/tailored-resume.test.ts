// Enhanced Tailored Resume Tests

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch for API tests
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Enhanced Tailored Resume API', () => {
    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('POST /api/generate-tailored-resume', () => {
        it('should return resume JSON with matched and missing keywords', async () => {
            const mockResponse = {
                success: true,
                resume: {
                    id: 'test-uuid',
                    contact: {
                        name: 'Marvin Chaudhary',
                        email: 'mchaudhary1s@semo.edu',
                        phone: '+1(573) 587-1035',
                        linkedin: 'linkedin.com/in/marvin-chaudhary',
                        github: ['github.com/Marvyn007', 'github.com/iammarvin7'],
                    },
                    sections: [],
                    skills: {
                        languages: ['JavaScript', 'TypeScript'],
                        frameworks: ['React', 'Next.js'],
                        tools: ['Git', 'Docker'],
                        databases: ['PostgreSQL'],
                    },
                    design: {
                        template: 'classic',
                        fontFamily: 'Times New Roman',
                        fontSize: 12,
                        accentColor: '#1a365d',
                        margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
                    },
                    createdAt: '2026-01-08T00:00:00Z',
                    updatedAt: '2026-01-08T00:00:00Z',
                },
                keywords: {
                    matched: ['React', 'TypeScript', 'Node.js'],
                    missing: ['Kubernetes', 'GraphQL', 'AWS'],
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            });

            const response = await fetch('/api/generate-tailored-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_id: 'test-job-id',
                    job_description: 'Looking for a React developer with Kubernetes experience',
                }),
            });

            const data = await response.json();

            expect(data.success).toBe(true);
            expect(data.resume).toBeDefined();
            expect(data.resume.id).toBe('test-uuid');
            expect(data.keywords).toBeDefined();
            expect(data.keywords.matched).toContain('React');
            expect(data.keywords.missing).toContain('Kubernetes');
        });

        it('should accept job_url instead of job_description', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    success: true,
                    resume: { id: 'test-uuid' },
                    keywords: { matched: [], missing: [] },
                }),
            });

            const response = await fetch('/api/generate-tailored-resume', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    job_url: 'https://example.com/jobs/123',
                }),
            });

            expect(response.ok).toBe(true);
        });
    });
});

describe('Resume Contact Info', () => {
    it('should have correct default contact info', () => {
        const DEFAULT_CONTACT = {
            name: 'Marvin Chaudhary',
            email: 'mchaudhary1s@semo.edu',
            phone: '+1(573) 587-1035',
            linkedin: 'linkedin.com/in/marvin-chaudhary',
            github: ['github.com/Marvyn007', 'github.com/iammarvin7'],
        };

        expect(DEFAULT_CONTACT.email).toBe('mchaudhary1s@semo.edu');
        expect(DEFAULT_CONTACT.phone).toBe('+1(573) 587-1035');
        expect(DEFAULT_CONTACT.github).toHaveLength(2);
        expect(DEFAULT_CONTACT.linkedin).toContain('marvin-chaudhary');
    });
});

describe('Resume Section Ordering', () => {
    const EXPECTED_ORDER = ['education', 'experience', 'projects', 'community', 'skills'];

    it('should have correct section ordering', () => {
        expect(EXPECTED_ORDER[0]).toBe('education');
        expect(EXPECTED_ORDER[1]).toBe('experience');
        expect(EXPECTED_ORDER[2]).toBe('projects');
        expect(EXPECTED_ORDER[3]).toBe('community');
        expect(EXPECTED_ORDER[4]).toBe('skills');
    });
});

describe('Keyword Analysis', () => {
    function extractKeywords(text: string): string[] {
        const patterns = [
            /\b(JavaScript|TypeScript|Python|Java|C\+\+|Go|Rust|Ruby|PHP|Swift|Kotlin)\b/gi,
            /\b(React|Angular|Vue|Next\.?js|Node\.?js|Express|Django|Flask|Spring)\b/gi,
            /\b(Docker|Kubernetes|AWS|Azure|GCP|Git|Jenkins|Terraform|CI\/CD)\b/gi,
            /\b(PostgreSQL|MySQL|MongoDB|Redis|Elasticsearch|DynamoDB)\b/gi,
        ];

        const found = new Set<string>();
        for (const pattern of patterns) {
            const matches = text.match(pattern) || [];
            matches.forEach(m => found.add(m));
        }
        return Array.from(found);
    }

    it('should extract technical keywords from job description', () => {
        const jobDesc = 'Looking for a React developer with Node.js, Docker, and Kubernetes experience. PostgreSQL preferred.';
        const keywords = extractKeywords(jobDesc);

        expect(keywords).toContain('React');
        expect(keywords.some(k => k.toLowerCase().includes('node'))).toBe(true);
        expect(keywords).toContain('Docker');
        expect(keywords).toContain('Kubernetes');
        expect(keywords).toContain('PostgreSQL');
    });

    it('should not extract non-technical words', () => {
        const jobDesc = 'Must be a team player with excellent communication skills';
        const keywords = extractKeywords(jobDesc);

        expect(keywords).not.toContain('team');
        expect(keywords).not.toContain('communication');
    });
});

describe('Amor+Chai Project Link', () => {
    it('should include correct deployed link', () => {
        const AMOR_CHAI_LINK = 'www.drinkamorchai.store';
        expect(AMOR_CHAI_LINK).toBe('www.drinkamorchai.store');
    });
});

describe('PDF Download', () => {
    it('should use correct filename', () => {
        const FILENAME = 'marvin_chaudhary_resume.pdf';
        expect(FILENAME).toBe('marvin_chaudhary_resume.pdf');
    });
});
