/**
 * Job Validation Module Tests
 * 
 * Tests for:
 * - Domain blocking (LinkedIn, Indeed, Glassdoor)
 * - Description validation (length, truncation, placeholders)
 * - Scrape result validation (confidence thresholds)
 * - Error message generation
 */

import { describe, it, expect } from 'vitest';
import {
    validateJobSourceDomain,
    validateJobDescription,
    validateJobScrapeResult,
    getValidationErrorMessage,
    BLOCKED_DOMAINS,
    MIN_DESCRIPTION_LENGTH,
    CONFIDENCE_THRESHOLDS,
} from '../src/lib/job-validation';

describe('Domain Validation', () => {
    it('should block LinkedIn URLs', () => {
        const result = validateJobSourceDomain('https://www.linkedin.com/jobs/view/12345');
        expect(result.valid).toBe(false);
        expect(result.blockedDomain).toBe('linkedin.com');
    });

    it('should block Indeed URLs', () => {
        const result = validateJobSourceDomain('https://indeed.com/jobs?q=developer');
        expect(result.valid).toBe(false);
        expect(result.blockedDomain).toBe('indeed.com');
    });

    it('should block Glassdoor URLs', () => {
        const result = validateJobSourceDomain('https://glassdoor.com/job/developer-12345');
        expect(result.valid).toBe(false);
        expect(result.blockedDomain).toBe('glassdoor.com');
    });

    it('should block subdomains of blocked sites', () => {
        const result = validateJobSourceDomain('https://jobs.linkedin.com/view/12345');
        expect(result.valid).toBe(false);
        expect(result.blockedDomain).toBe('linkedin.com');
    });

    it('should allow valid job board URLs', () => {
        const validUrls = [
            'https://careers.google.com/jobs/12345',
            'https://boards.greenhouse.io/openai/jobs/5661044',
            'https://jobs.lever.co/missionlane/example',
            'https://stripe.com/jobs/12345',
        ];

        for (const url of validUrls) {
            const result = validateJobSourceDomain(url);
            expect(result.valid).toBe(true);
        }
    });

    it('should handle invalid URLs gracefully', () => {
        const result = validateJobSourceDomain('not-a-url');
        expect(result.valid).toBe(false);
        expect(result.blockedDomain).toBe('invalid URL');
    });
});

describe('Description Validation', () => {
    it('should reject empty description', () => {
        const result = validateJobDescription('');
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('empty');
    });

    it('should reject too short description', () => {
        const shortDesc = 'Job description too short...';
        const result = validateJobDescription(shortDesc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('too short');
        expect(result.length).toBe(shortDesc.length);
    });

    it('should reject description below minimum length', () => {
        const justBelowMin = 'a'.repeat(MIN_DESCRIPTION_LENGTH - 1);
        const result = validateJobDescription(justBelowMin);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain(`${MIN_DESCRIPTION_LENGTH - 1} characters`);
    });

    it('should accept description at minimum length', () => {
        const atMin = 'a'.repeat(MIN_DESCRIPTION_LENGTH);
        const result = validateJobDescription(atMin);
        expect(result.valid).toBe(true);
        expect(result.length).toBe(MIN_DESCRIPTION_LENGTH);
    });

    it('should accept description above minimum length', () => {
        const aboveMin = 'a'.repeat(MIN_DESCRIPTION_LENGTH + 100);
        const result = validateJobDescription(aboveMin);
        expect(result.valid).toBe(true);
        expect(result.length).toBe(MIN_DESCRIPTION_LENGTH + 100);
    });

    it('should reject description with placeholder text "view full description"', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + ' view full description here';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('placeholder');
    });

    it('should reject description with placeholder text "please log in"', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + ' please log in to continue';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('placeholder');
    });

    it('should reject truncated description ending with ...', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + '...';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('truncated');
    });

    it('should accept complete description ending with period', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + '. This is end.';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(true);
    });

    it('should accept complete description ending with exclamation', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + '! This is exciting.';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(true);
    });

    it('should be case-insensitive for placeholder detection', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + ' VIEW FULL DESCRIPTION';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('placeholder');
    });



    it('should accept complete description ending with period', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + '. This is the end.';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(true);
    });

    it('should be case-insensitive for placeholder detection', () => {
        const desc = 'a'.repeat(MIN_DESCRIPTION_LENGTH) + ' VIEW FULL DESCRIPTION';
        const result = validateJobDescription(desc);
        expect(result.valid).toBe(false);
        expect(result.reason).toContain('placeholder');
    });
});

describe('Scrape Result Validation', () => {
    const createValidScrapeResult = () => ({
        title: 'Software Engineer',
        company: 'Test Company',
        location: 'San Francisco, CA',
        source_url: 'https://example.com/job',
        source_host: 'example.com',
        raw_description_html: '<p>Test description</p>',
        job_description_plain: 'Test description',
        normalized_text: 'Test description',
        extracted_skills: [],
        date_posted_iso: '2024-01-01T00:00:00Z',
        date_posted_display: 'Posted: Today',
        date_posted_relative: false,
        scraped_at: '2024-01-01T00:00:00Z',
        confidence: {
            description: CONFIDENCE_THRESHOLDS.description,
            date: CONFIDENCE_THRESHOLDS.date,
            location: CONFIDENCE_THRESHOLDS.location,
        },
    });

    it('should accept scrape result with all confidence thresholds met', () => {
        const result = validateJobScrapeResult(createValidScrapeResult());
        expect(result.valid).toBe(true);
        expect(result.reasons).toHaveLength(0);
    });

    it('should reject scrape result with low description confidence', () => {
        const scrapeResult = createValidScrapeResult();
        scrapeResult.confidence.description = CONFIDENCE_THRESHOLDS.description - 0.1 as any;

        const result = validateJobScrapeResult(scrapeResult);
        expect(result.valid).toBe(false);
        expect(result.reasons.length).toBeGreaterThan(0);
        expect(result.reasons[0]).toContain('description confidence');
    });

    it('should reject scrape result with low date confidence', () => {
        const scrapeResult = createValidScrapeResult();
        scrapeResult.confidence.date = CONFIDENCE_THRESHOLDS.date - 0.1 as any;

        const result = validateJobScrapeResult(scrapeResult);
        expect(result.valid).toBe(false);
        expect(result.reasons.length).toBeGreaterThan(0);
        expect(result.reasons[0]).toContain('date confidence');
    });

    it('should reject scrape result with low location confidence', () => {
        const scrapeResult = createValidScrapeResult();
        scrapeResult.confidence.location = CONFIDENCE_THRESHOLDS.location - 0.1 as any;

        const result = validateJobScrapeResult(scrapeResult);
        expect(result.valid).toBe(false);
        expect(result.reasons.length).toBeGreaterThan(0);
        expect(result.reasons[0]).toContain('location confidence');
    });

    it('should report multiple confidence issues', () => {
        const scrapeResult = createValidScrapeResult();
        scrapeResult.confidence.description = CONFIDENCE_THRESHOLDS.description - 0.2 as any;
        scrapeResult.confidence.date = CONFIDENCE_THRESHOLDS.date - 0.1 as any;

        const result = validateJobScrapeResult(scrapeResult);
        expect(result.valid).toBe(false);
        expect(result.reasons.length).toBeGreaterThan(1);
    });
});

describe('Error Message Generation', () => {
    it('should generate message for blocked LinkedIn domain', () => {
        const result = getValidationErrorMessage({
            domainValidation: {
                valid: false,
                blockedDomain: 'linkedin.com',
            },
        });
        expect(result).toContain('linkedin.com');
        expect(result).toContain('cannot be fetched');
        expect(result).toContain('original job posting link');
    });

    it('should generate message for blocked Indeed domain', () => {
        const result = getValidationErrorMessage({
            domainValidation: {
                valid: false,
                blockedDomain: 'indeed.com',
            },
        });
        expect(result).toContain('indeed.com');
    });

    it('should generate message for blocked Glassdoor domain', () => {
        const result = getValidationErrorMessage({
            domainValidation: {
                valid: false,
                blockedDomain: 'glassdoor.com',
            },
        });
        expect(result).toContain('glassdoor.com');
    });

    it('should return description validation reason', () => {
        const result = getValidationErrorMessage({
            descriptionValidation: {
                valid: false,
                reason: 'Job description too short (100 characters, minimum 3000)',
            },
        });
        expect(result).toContain('too short');
        expect(result).toContain('3000');
    });

    it('should return single scrape validation reason', () => {
        const result = getValidationErrorMessage({
            scrapeValidation: {
                valid: false,
                reasons: ['Low description confidence (50%)'],
            },
        });
        expect(result).toContain('Low description confidence');
    });

    it('should return multiple scrape validation reasons', () => {
        const result = getValidationErrorMessage({
            scrapeValidation: {
                valid: false,
                reasons: ['Low description confidence (50%)', 'Low date confidence (40%)'],
            },
        });
        expect(result).toContain('Low description confidence');
        expect(result).toContain('Low date confidence');
        expect(result).toContain('Issues:');
    });

    it('should prioritize domain validation over others', () => {
        const result = getValidationErrorMessage({
            domainValidation: {
                valid: false,
                blockedDomain: 'linkedin.com',
            },
            descriptionValidation: {
                valid: false,
                reason: 'Too short',
            },
        });
        expect(result).toContain('linkedin.com');
        expect(result).not.toContain('Too short');
    });

    it('should return fallback message when no specific validation provided', () => {
        const result = getValidationErrorMessage({});
        expect(result).toBe('Job validation failed');
    });
});

describe('Configuration Constants', () => {
    it('should have all expected blocked domains', () => {
        expect(BLOCKED_DOMAINS).toContain('linkedin.com');
        expect(BLOCKED_DOMAINS).toContain('indeed.com');
        expect(BLOCKED_DOMAINS).toContain('glassdoor.com');
    });

    it('should have minimum description length of 3000', () => {
        expect(MIN_DESCRIPTION_LENGTH).toBe(3000);
    });

    it('should have confidence thresholds for description, date, and location', () => {
        expect(CONFIDENCE_THRESHOLDS.description).toBe(0.6);
        expect(CONFIDENCE_THRESHOLDS.date).toBe(0.5);
        expect(CONFIDENCE_THRESHOLDS.location).toBe(0.4);
    });
});
