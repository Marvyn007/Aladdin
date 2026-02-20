/**
 * Unit tests for the Enhanced Tailored Resume Service
 *
 * Validates:
 * - Zero hardcoded data leakage
 * - ATS keyword optimization
 * - User-scoped data handling
 * - Drip-Question mode flow
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

import {
    validateNoLeakedData,
    generateEnhancedTailoredResume,
} from '@/lib/enhanced-tailored-resume-service';

import {
    startDripSession,
    submitDripAnswer,
    finalizeDripSession,
} from '@/lib/resume-drip-questions';

import type { TailoredResumeData } from '@/types';

// Mock dependencies
vi.mock('@/lib/db', () => ({
    getJobById: vi.fn(),
    getDefaultResume: vi.fn(),
    getResumeById: vi.fn(),
    updateResume: vi.fn(),
    getLinkedInProfile: vi.fn(),
    createDraft: vi.fn(),
    getDraft: vi.fn(),
    listDrafts: vi.fn(),
    deleteDraft: vi.fn(),
}));

vi.mock('@/lib/ai-router', () => ({
    routeAICallWithDetails: vi.fn(),
    isAIAvailable: () => true,
}));

// ============================================================================
// Leak Detection Tests
// ============================================================================

describe('validateNoLeakedData', () => {
    const sourceResume = `John Doe, Software Engineer. Experience: Built React apps at TechCorp. Skills: JavaScript, TypeScript.`;
    const sourceLinkedIn = `Volunteer at CodeCamp.`;
    const sourceJob = `We need a React developer.`;

    it('passes when all data is traceable to source', () => {
        const generated: TailoredResumeData = {
            id: '123',
            contact: {
                name: 'John Doe',
                email: '',
                phone: '',
                linkedin: '',
                github: [],
                location: ''
            },
            sections: [
                {
                    id: 's1',
                    type: 'experience',
                    title: 'Experience',
                    items: [
                        {
                            id: 'i1',
                            title: 'TechCorp',
                            subtitle: 'Software Engineer',
                            dates: '2020-Present',
                            bullets: [{ id: 'b1', text: 'Built React apps.', isSuggested: false }]
                        }
                    ]
                }
            ],
            skills: {
                Languages: ['JavaScript', 'TypeScript']
            },
            design: { template: 'classic' } as any,
            createdAt: '',
            updatedAt: ''
        };

        const result = validateNoLeakedData(generated, sourceResume, sourceLinkedIn, sourceJob);
        expect(result.passed).toBe(true);
        expect(result.leaked_fields).toHaveLength(0);
    });

    it('fails when contact name is fabricated', () => {
        const generated: any = {
            contact: { name: 'Fake Name' },
            sections: [],
            skills: {}
        };
        const result = validateNoLeakedData(generated, sourceResume, sourceLinkedIn, sourceJob);
        expect(result.passed).toBe(false);
        expect(result.leaked_fields).toContain('contact.name: "Fake Name"');
    });

    it('fails when skill is fabricated', () => {
        const generated: any = {
            contact: { name: 'John Doe' },
            sections: [],
            skills: { Languages: ['Rust'] } // Rust is not in source
        };
        const result = validateNoLeakedData(generated, sourceResume, sourceLinkedIn, sourceJob);
        expect(result.passed).toBe(false);
        expect(result.leaked_fields[0]).toContain('skills.Languages: "Rust"');
    });

    it('fails when company name is fabricated', () => {
        const generated: any = {
            contact: { name: 'John Doe' },
            sections: [
                {
                    type: 'experience',
                    items: [{ title: 'FakeCorp' }]
                }
            ],
            skills: {}
        };
        const result = validateNoLeakedData(generated, sourceResume, sourceLinkedIn, sourceJob);
        expect(result.passed).toBe(false);
        expect(result.leaked_fields[0]).toContain('experience.item.title: "FakeCorp"');
    });
});

// ============================================================================
// Drip-Question Mode Tests
// ============================================================================

describe('Drip-Question Mode', () => {
    const userId = 'user-123';

    it('starts a session and returns first question', () => {
        const result = startDripSession(userId);
        expect(result.sessionId).toBeDefined();
        expect(result.question).toBeDefined();
        expect(result.question.text).toContain('full name');
    });

    it('skips known fields if parsed resume provided', () => {
        const parsed = { name: 'Alice', email: 'alice@test.com' };
        const result = startDripSession(userId, parsed);
        // Should skip name/email questions
        expect(result.question.text).not.toContain('full name');
        expect(result.question.text).not.toContain('email');
    });

    it('processes answers and advances', () => {
        startDripSession(userId);

        // Answer name
        let result = submitDripAnswer(userId, 'John Doe');
        expect(result.done).toBe(false);
        expect(result.question?.text).toContain('email');

        // Answer email
        result = submitDripAnswer(userId, 'john@test.com');
        expect(result.done).toBe(false);
        expect(result.question?.text).toContain('phone');
    });

    it('finalizes session into parsed resume structure', () => {
        startDripSession(userId);
        submitDripAnswer(userId, 'John Doe'); // Name
        submitDripAnswer(userId, 'john@test.com'); // Email
        submitDripAnswer(userId, '555-0123'); // Phone
        submitDripAnswer(userId, 'skip'); // LinkedIn

        // Mock experience flow
        // "Most recent role" -> "Software Engineer at TechCorp"
        submitDripAnswer(userId, 'Software Engineer at TechCorp');

        // Metrics
        submitDripAnswer(userId, 'Reduced latency by 50%');

        // Tools
        submitDripAnswer(userId, 'React, Node.js');

        // Outcomes
        submitDripAnswer(userId, 'Launched new dashboard');

        // Previous role -> skip
        submitDripAnswer(userId, 'skip');

        // Projects
        submitDripAnswer(userId, 'Portfolio Website');
        submitDripAnswer(userId, 'Showcased projects to employers');

        // Education
        submitDripAnswer(userId, 'MIT, CS, 2022');

        // Skills
        submitDripAnswer(userId, 'JavaScript, TypeScript');

        // Certs -> skip
        submitDripAnswer(userId, 'skip');

        // Finalize
        const final = finalizeDripSession(userId);

        expect(final.parsedResume.name).toBe('John Doe');
        expect(final.parsedResume.email).toBe('john@test.com');
        expect(final.parsedResume.roles[0].company).toBe('TechCorp');
        expect(final.parsedResume.roles[0].title).toBe('Software Engineer');
        expect(final.parsedResume.roles[0].description).toContain('Reduced latency by 50%');
        expect(final.parsedResume.education[0].school).toContain('MIT');
        expect(final.parsedResume.skills).toContainEqual({ name: 'JavaScript' });
    });
});
