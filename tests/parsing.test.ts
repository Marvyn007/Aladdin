// Unit tests for parsing and job filtering functions

import { describe, it, expect } from 'vitest';
import {
    normalizeText,
    isInternshipOrEntryLevel,
    isUSLocation,
    isSoftwareEngineeringRole,
    validateJobCriteria
} from '../src/lib/job-utils';
import { generateContentHash } from '../src/lib/db';

describe('normalizeText', () => {
    it('should lowercase and trim text', () => {
        expect(normalizeText('  Hello World  ')).toBe('hello world');
    });

    it('should replace multiple spaces with single space', () => {
        expect(normalizeText('hello    world')).toBe('hello world');
    });

    it('should remove special characters', () => {
        expect(normalizeText('hello! world?')).toBe('hello world');
    });
});

describe('isInternshipOrEntryLevel', () => {
    it('should detect internship in title', () => {
        expect(isInternshipOrEntryLevel('Software Engineering Intern')).toBe(true);
        expect(isInternshipOrEntryLevel('Internship Program')).toBe(true);
    });

    it('should detect entry-level keywords', () => {
        expect(isInternshipOrEntryLevel('Entry-Level Developer')).toBe(true);
        expect(isInternshipOrEntryLevel('New Grad Software Engineer')).toBe(true);
        expect(isInternshipOrEntryLevel('Junior Developer')).toBe(true);
    });

    it('should return false for senior roles', () => {
        expect(isInternshipOrEntryLevel('Senior Software Engineer')).toBe(false);
        expect(isInternshipOrEntryLevel('Staff Engineer')).toBe(false);
        expect(isInternshipOrEntryLevel('Principal Developer')).toBe(false);
    });

    it('should check description if title does not match', () => {
        expect(isInternshipOrEntryLevel('Developer', 'This is an internship position')).toBe(true);
    });
});

describe('isUSLocation', () => {
    it('should detect US cities and states', () => {
        expect(isUSLocation('San Francisco, CA')).toBe(true);
        expect(isUSLocation('New York, NY')).toBe(true);
        expect(isUSLocation('Seattle, WA')).toBe(true);
    });

    it('should detect remote locations', () => {
        expect(isUSLocation('Remote')).toBe(true);
        expect(isUSLocation('Hybrid / Remote')).toBe(true);
    });

    it('should allow null location (might be remote)', () => {
        expect(isUSLocation(null)).toBe(true);
    });

    it('should reject non-US locations', () => {
        expect(isUSLocation('London, UK')).toBe(false);
        expect(isUSLocation('Berlin, Germany')).toBe(false);
        expect(isUSLocation('Toronto, Canada')).toBe(false);
    });
});

describe('isSoftwareEngineeringRole', () => {
    it('should detect software engineering titles', () => {
        expect(isSoftwareEngineeringRole('Software Engineer')).toBe(true);
        expect(isSoftwareEngineeringRole('Frontend Developer')).toBe(true);
        expect(isSoftwareEngineeringRole('Backend Engineer')).toBe(true);
        expect(isSoftwareEngineeringRole('Full Stack Developer')).toBe(true);
    });

    it('should detect related roles', () => {
        expect(isSoftwareEngineeringRole('DevOps Engineer')).toBe(true);
        expect(isSoftwareEngineeringRole('Data Engineer')).toBe(true);
        expect(isSoftwareEngineeringRole('ML Engineer')).toBe(true);
    });

    it('should reject non-engineering roles', () => {
        expect(isSoftwareEngineeringRole('Product Manager')).toBe(false);
        expect(isSoftwareEngineeringRole('UX Designer')).toBe(false);
        expect(isSoftwareEngineeringRole('Marketing Analyst')).toBe(false);
    });
});

describe('validateJobCriteria', () => {
    it('should validate a good job', () => {
        const result = validateJobCriteria(
            'Software Engineering Intern',
            'Python, React development',
            'San Francisco, CA'
        );
        expect(result.valid).toBe(true);
    });

    it('should reject non-software roles', () => {
        const result = validateJobCriteria(
            'Marketing Manager',
            'Lead marketing campaigns',
            'New York, NY'
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Not a software engineering role');
    });

    it('should reject senior roles', () => {
        const result = validateJobCriteria(
            'Senior Software Engineer',
            '10+ years experience required',
            'Seattle, WA'
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Not internship or entry-level');
    });

    it('should reject non-US locations', () => {
        const result = validateJobCriteria(
            'Software Engineering Intern',
            'Great opportunity',
            'London, UK'
        );
        expect(result.valid).toBe(false);
        expect(result.reason).toBe('Not a US location');
    });
});

describe('generateContentHash', () => {
    it('should generate consistent hashes', () => {
        const hash1 = generateContentHash('Title', 'Company', 'Location', 'Text');
        const hash2 = generateContentHash('Title', 'Company', 'Location', 'Text');
        expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different content', () => {
        const hash1 = generateContentHash('Title1', 'Company', 'Location', 'Text');
        const hash2 = generateContentHash('Title2', 'Company', 'Location', 'Text');
        expect(hash1).not.toBe(hash2);
    });

    it('should handle null values', () => {
        const hash = generateContentHash('Title', null, null, 'Text');
        expect(hash).toBeTruthy();
    });
});
