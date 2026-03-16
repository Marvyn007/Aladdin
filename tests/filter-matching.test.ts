import { describe, it, expect } from 'vitest';
import { jobMatchesFilters, checkJobMatchFields } from '@/contexts/FilterContext';
import type { Job } from '@/types';

const createMockJob = (overrides: Partial<Job> = {}): Job => ({
    id: '1',
    title: 'Software Engineer',
    company: 'Google',
    location: 'New York, NY',
    source_url: 'https://example.com',
    posted_at: '2024-01-01',
    fetched_at: '2024-01-01',
    status: 'fresh',
    match_score: 0,
    matched_skills: ['JavaScript', 'React'],
    missing_skills: null,
    why: null,
    normalized_text: null,
    raw_text_summary: null,
    content_hash: null,
    ...overrides
});

describe('jobMatchesFilters', () => {
    describe('basic matching', () => {
        it('should return true when no filters are provided', () => {
            expect(jobMatchesFilters('Software Engineer at Google', [])).toBe(true);
            expect(jobMatchesFilters('', [])).toBe(true);
        });

        it('should return true when job text is empty', () => {
            expect(jobMatchesFilters('', ['senior'])).toBe(true);
        });

        it('should match whole words case-insensitively', () => {
            expect(jobMatchesFilters('Senior Software Engineer', ['senior'])).toBe(true);
            expect(jobMatchesFilters('SENIOR Software Engineer', ['senior'])).toBe(true);
            expect(jobMatchesFilters('Software Engineer', ['senior'])).toBe(false);
            expect(jobMatchesFilters('Lead Developer', ['lead'])).toBe(true);
        });

        it('should not match partial words', () => {
            expect(jobMatchesFilters('Pleading Engineer', ['lead'])).toBe(false);
            expect(jobMatchesFilters('President', ['pres'])).toBe(false);
        });
    });

    describe('phrase matching with quotes', () => {
        it('should match exact phrases when quoted', () => {
            expect(jobMatchesFilters('Senior Software Engineer', ['"senior software"'])).toBe(true);
            expect(jobMatchesFilters('Senior Software Engineer', ['"senior"'])).toBe(true);
            expect(jobMatchesFilters('Software Engineer', ['"senior software"'])).toBe(false);
        });

        it('should handle quoted phrases with spaces', () => {
            expect(jobMatchesFilters('Full Stack Developer', ['"full stack"'])).toBe(true);
            expect(jobMatchesFilters('Full Stack Developer', ['"full-stack"'])).toBe(false);
        });
    });

    describe('multiple filters (AND logic)', () => {
        it('should require all filters to match', () => {
            expect(jobMatchesFilters('Senior Software Engineer at Google', ['senior', 'software'])).toBe(true);
            expect(jobMatchesFilters('Senior Engineer at Google', ['senior', 'software'])).toBe(false);
            expect(jobMatchesFilters('Software Engineer at Google', ['senior', 'software'])).toBe(false);
        });

        it('should handle empty filter strings', () => {
            expect(jobMatchesFilters('Senior Engineer', ['senior', ''])).toBe(true);
            expect(jobMatchesFilters('Senior Engineer', [''])).toBe(true);
        });
    });

    describe('normalization', () => {
        it('should trim and lowercase filters', () => {
            expect(jobMatchesFilters('SENIOR Engineer', ['  Senior  '])).toBe(true);
            expect(jobMatchesFilters('Software Engineer', ['  software  '])).toBe(true);
        });

        it('should handle special characters in filters', () => {
            expect(jobMatchesFilters('TS/SCI Clearance Required', ['ts/sci'])).toBe(true);
            expect(jobMatchesFilters('Top Secret Clearance', ['ts/sci'])).toBe(false);
        });
    });

    describe('real-world job title examples', () => {
        it('should match seniority levels', () => {
            expect(jobMatchesFilters('Senior Software Engineer', ['senior'])).toBe(true);
            expect(jobMatchesFilters('Sr Software Engineer', ['sr'])).toBe(true);
            expect(jobMatchesFilters('Staff Engineer', ['staff'])).toBe(true);
            expect(jobMatchesFilters('Principal Architect', ['principal'])).toBe(true);
            expect(jobMatchesFilters('Engineering Manager', ['manager'])).toBe(true);
            expect(jobMatchesFilters('Director of Engineering', ['director'])).toBe(true);
        });

        it('should match clearance requirements', () => {
            expect(jobMatchesFilters('TS/SCI Clearance Required', ['clearance'])).toBe(true);
            expect(jobMatchesFilters('Must have TS/SCI polygraph', ['ts/sci'])).toBe(true);
            expect(jobMatchesFilters('Secret Clearance needed', ['secret'])).toBe(true);
        });

        it('should not false positive on similar words', () => {
            expect(jobMatchesFilters('Lead Product Manager', ['lead'])).toBe(true);
            expect(jobMatchesFilters('Lead Generation Specialist', ['lead'])).toBe(true);
            
            expect(jobMatchesFilters('Pleading Attorney', ['lead'])).toBe(false);
            expect(jobMatchesFilters('Misleading Information', ['lead'])).toBe(false);
            expect(jobMatchesFilters('Ahead Component', ['head'])).toBe(false);
        });
    });
});

describe('checkJobMatchFields', () => {
    describe('title matching', () => {
        it('should match filter in job title', () => {
            const job = createMockJob({ title: 'Senior Software Engineer' });
            const result = checkJobMatchFields(job, ['senior']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('title');
        });

        it('should not match if filter not in title', () => {
            const job = createMockJob({ title: 'Software Engineer' });
            const result = checkJobMatchFields(job, ['senior']);
            expect(result.matches).toBe(false);
        });
    });

    describe('company matching', () => {
        it('should match filter in company name', () => {
            const job = createMockJob({ company: 'Amazon' });
            const result = checkJobMatchFields(job, ['amazon']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('company');
        });

        it('should match case-insensitively in company', () => {
            const job = createMockJob({ company: 'GOOGLE' });
            const result = checkJobMatchFields(job, ['google']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('company');
        });
    });

    describe('location matching', () => {
        it('should match filter in location', () => {
            const job = createMockJob({ location: 'New York, NY' });
            const result = checkJobMatchFields(job, ['new york']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('location');
        });

        it('should match phrase in location', () => {
            const job = createMockJob({ location: 'San Francisco, CA' });
            const result = checkJobMatchFields(job, ['"san francisco"']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('location');
        });
    });

    describe('skills matching', () => {
        it('should match filter in matched_skills array', () => {
            const job = createMockJob({ matched_skills: ['Java', 'Python', 'React'] });
            const result = checkJobMatchFields(job, ['java']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('skills');
        });

        it('should match multiple skills', () => {
            const job = createMockJob({ matched_skills: ['Java', 'Python'] });
            const result = checkJobMatchFields(job, ['java', 'python']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('skills');
        });
    });

    describe('description fallback matching', () => {
        it('should match filter in raw_text_summary', () => {
            const job = createMockJob({ 
                matched_skills: null,
                raw_text_summary: 'Experience with Java and Python required'
            });
            const result = checkJobMatchFields(job, ['all:java']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('description');
        });
    });

    describe('multi-field matching', () => {
        it('should match across multiple fields', () => {
            const job = createMockJob({ 
                title: 'Software Engineer',
                company: 'Amazon',
                location: 'Seattle, WA',
                matched_skills: ['Java', 'AWS']
            });
            
            const result = checkJobMatchFields(job, ['amazon']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toContain('company');
            
            const result2 = checkJobMatchFields(job, ['java']);
            expect(result2.matches).toBe(true);
            expect(result2.matchedFields).toContain('skills');
            
            const result3 = checkJobMatchFields(job, ['seattle']);
            expect(result3.matches).toBe(true);
            expect(result3.matchedFields).toContain('location');
        });

        it('should return title as primary match when present', () => {
            const job = createMockJob({ 
                title: 'Java Developer',
                matched_skills: ['Python']
            });
            const result = checkJobMatchFields(job, ['java']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields[0]).toBe('title');
        });

        it('should return skills as primary match when title does not match', () => {
            const job = createMockJob({ 
                title: 'Developer',
                matched_skills: ['Java', 'Python']
            });
            const result = checkJobMatchFields(job, ['java']);
            expect(result.matches).toBe(true);
            expect(result.matchedFields[0]).toBe('skills');
        });
    });

    describe('whole-word matching', () => {
        it('should not partial match lead in pleading', () => {
            const job = createMockJob({ title: 'Pleading Attorney' });
            const result = checkJobMatchFields(job, ['lead']);
            expect(result.matches).toBe(false);
        });
    });

    describe('no filters', () => {
        it('should return match with empty fields when no filters', () => {
            const job = createMockJob();
            const result = checkJobMatchFields(job, []);
            expect(result.matches).toBe(true);
            expect(result.matchedFields).toEqual([]);
        });
    });
});
