// Unit tests for scoring functions

import { describe, it, expect } from 'vitest';
import type { ParsedResume, Job } from '../src/types';

// Mock scoring function for testing weights
function calculateScore(
    resume: ParsedResume,
    job: Partial<Job>,
    weights = { skills: 0.4, title: 0.2, level: 0.15, location: 0.1, techFit: 0.1, freshness: 0.05 }
): number {
    let score = 0;

    // Skills matching (40%)
    const resumeSkills = resume.skills.map(s => s.name.toLowerCase());
    const jobText = (job.normalized_text || '').toLowerCase();

    const matchedSkills = resumeSkills.filter(skill => jobText.includes(skill));
    const skillScore = Math.min(matchedSkills.length / 5, 1) * 100; // Cap at 5 skills
    score += skillScore * weights.skills;

    // Title/keyword match (20%)
    const jobTitle = (job.title || '').toLowerCase();
    const titleKeywords = ['engineer', 'developer', 'software', 'intern', 'junior'];
    const titleMatch = titleKeywords.some(kw => jobTitle.includes(kw)) ? 80 : 40;
    score += titleMatch * weights.title;

    // Level match (15%)
    const openTo = resume.open_to.map(o => o.toLowerCase());
    const levelKeywords = ['intern', 'entry', 'junior', 'new grad'];
    const levelMatch = levelKeywords.some(kw => jobTitle.includes(kw)) && openTo.includes('internship') ? 100 : 50;
    score += levelMatch * weights.level;

    // Location (10%)
    const location = (job.location || '').toLowerCase();
    const locationScore = location.includes('remote') || location.includes('hybrid') ? 100 : 70;
    score += locationScore * weights.location;

    // Tech fit (10%)
    const techFitScore = matchedSkills.length > 2 ? 80 : 50;
    score += techFitScore * weights.techFit;

    // Freshness (5%)
    const postedAt = job.posted_at ? new Date(job.posted_at) : null;
    const hoursAgo = postedAt ? (Date.now() - postedAt.getTime()) / (1000 * 60 * 60) : 24;
    const freshnessScore = hoursAgo < 6 ? 100 : hoursAgo < 12 ? 80 : hoursAgo < 24 ? 60 : 40;
    score += freshnessScore * weights.freshness;

    return Math.round(score);
}

describe('Score Calculation', () => {
    const mockResume: ParsedResume = {
        name: 'Test User',
        email: 'test@example.com',
        location: 'San Francisco, CA',
        total_experience_years: 1,
        roles: [],
        education: [],
        skills: [
            { name: 'Python', level: 'advanced', years: 2 },
            { name: 'JavaScript', level: 'advanced', years: 2 },
            { name: 'React', level: 'intermediate', years: 1 },
            { name: 'SQL', level: 'intermediate', years: 1 },
        ],
        projects: [],
        certifications: [],
        open_to: ['internship', 'entry-level'],
    };

    it('should give higher score for more skill matches', () => {
        const job1: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python javascript react developer',
            location: 'San Francisco, CA',
            posted_at: new Date().toISOString(),
        };

        const job2: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'go rust kubernetes developer',
            location: 'San Francisco, CA',
            posted_at: new Date().toISOString(),
        };

        const score1 = calculateScore(mockResume, job1);
        const score2 = calculateScore(mockResume, job2);

        expect(score1).toBeGreaterThan(score2);
    });

    it('should favor remote/hybrid positions slightly', () => {
        const remoteJob: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python javascript',
            location: 'Remote',
            posted_at: new Date().toISOString(),
        };

        const onsiteJob: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python javascript',
            location: 'Austin, TX',
            posted_at: new Date().toISOString(),
        };

        const remoteScore = calculateScore(mockResume, remoteJob);
        const onsiteScore = calculateScore(mockResume, onsiteJob);

        expect(remoteScore).toBeGreaterThan(onsiteScore);
    });

    it('should favor fresher postings', () => {
        const freshJob: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python',
            location: 'SF, CA',
            posted_at: new Date().toISOString(),
        };

        const oldJob: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python',
            location: 'SF, CA',
            posted_at: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(),
        };

        const freshScore = calculateScore(mockResume, freshJob);
        const oldScore = calculateScore(mockResume, oldJob);

        expect(freshScore).toBeGreaterThan(oldScore);
    });

    it('should return score between 0 and 100', () => {
        const job: Partial<Job> = {
            title: 'Software Engineering Intern',
            normalized_text: 'python javascript react sql machine learning aws docker kubernetes',
            location: 'Remote',
            posted_at: new Date().toISOString(),
        };

        const score = calculateScore(mockResume, job);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });

    it('should handle missing job fields gracefully', () => {
        const minimalJob: Partial<Job> = {
            title: 'Developer',
        };

        const score = calculateScore(mockResume, minimalJob);

        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
    });
});

describe('Score Weights', () => {
    it('should sum to 100%', () => {
        const weights = { skills: 0.4, title: 0.2, level: 0.15, location: 0.1, techFit: 0.1, freshness: 0.05 };
        const sum = Object.values(weights).reduce((a, b) => a + b, 0);
        expect(sum).toBe(1);
    });

    it('skills should have highest weight', () => {
        const weights = { skills: 0.4, title: 0.2, level: 0.15, location: 0.1, techFit: 0.1, freshness: 0.05 };
        const maxWeight = Math.max(...Object.values(weights));
        expect(weights.skills).toBe(maxWeight);
    });
});
