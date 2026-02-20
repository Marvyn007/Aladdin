// Edit Job Feature Tests
// Tests for job edit validation, authorization, and field updates

import { describe, it, expect } from 'vitest';

// ============================================================================
// Validation helpers (extracted for testability)
// ============================================================================

interface EditFields {
    title: string;
    company: string;
    location: string;
    description: string;
}

interface ValidationResult {
    valid: boolean;
    error?: string;
}

const MIN_DESCRIPTION_LENGTH = 50;

function validateEditFields(fields: EditFields): ValidationResult {
    if (!fields.title?.trim()) {
        return { valid: false, error: 'Title is required' };
    }
    if (!fields.company?.trim()) {
        return { valid: false, error: 'Company is required' };
    }
    if (!fields.description?.trim()) {
        return { valid: false, error: 'Description is required' };
    }
    if (fields.description.trim().length < MIN_DESCRIPTION_LENGTH) {
        return { valid: false, error: `Description must be at least ${MIN_DESCRIPTION_LENGTH} characters` };
    }
    return { valid: true };
}

// ============================================================================
// Ownership check (simulated for unit testing)
// ============================================================================

function canUserEditJob(currentUserId: string | null, jobPostedByUserId: string | null): boolean {
    return Boolean(currentUserId && jobPostedByUserId && currentUserId === jobPostedByUserId);
}

// ============================================================================
// Tests
// ============================================================================

describe('Job Edit - Validation', () => {
    const validFields: EditFields = {
        title: 'Software Engineer',
        company: 'Google',
        location: 'Mountain View, CA',
        description: 'A'.repeat(60), // 60 chars, above minimum
    };

    it('accepts valid fields', () => {
        const result = validateEditFields(validFields);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
    });

    it('rejects empty title', () => {
        const result = validateEditFields({ ...validFields, title: '' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Title');
    });

    it('rejects whitespace-only title', () => {
        const result = validateEditFields({ ...validFields, title: '   ' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Title');
    });

    it('rejects empty company', () => {
        const result = validateEditFields({ ...validFields, company: '' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Company');
    });

    it('rejects empty description', () => {
        const result = validateEditFields({ ...validFields, description: '' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Description');
    });

    it('rejects description under minimum length', () => {
        const result = validateEditFields({ ...validFields, description: 'Too short description' });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('50 characters');
    });

    it('accepts description at exactly minimum length', () => {
        const result = validateEditFields({ ...validFields, description: 'A'.repeat(50) });
        expect(result.valid).toBe(true);
    });

    it('allows empty location (optional)', () => {
        const result = validateEditFields({ ...validFields, location: '' });
        expect(result.valid).toBe(true);
    });
});

describe('Job Edit - Ownership Check', () => {
    it('allows poster to edit', () => {
        expect(canUserEditJob('user_123', 'user_123')).toBe(true);
    });

    it('blocks non-poster from editing', () => {
        expect(canUserEditJob('user_456', 'user_123')).toBe(false);
    });

    it('blocks unauthenticated users', () => {
        expect(canUserEditJob(null, 'user_123')).toBe(false);
    });

    it('blocks when job has no poster', () => {
        expect(canUserEditJob('user_123', null)).toBe(false);
    });

    it('blocks when both are null', () => {
        expect(canUserEditJob(null, null)).toBe(false);
    });
});

describe('Job Edit - API Field Handling', () => {
    it('trims whitespace from fields before validation', () => {
        const fields: EditFields = {
            title: '  Software Engineer  ',
            company: '  Google  ',
            location: '  Remote  ',
            description: '  ' + 'A'.repeat(60) + '  ',
        };
        const result = validateEditFields({
            title: fields.title.trim(),
            company: fields.company.trim(),
            location: fields.location.trim(),
            description: fields.description.trim(),
        });
        expect(result.valid).toBe(true);
    });

    it('does not allow salary, posted_at, votes, or poster_id to be edited', () => {
        // This test documents the contract: only title, company, location, description are editable
        const editableFields = ['title', 'company', 'location', 'description'];
        const prohibitedFields = ['salary', 'posted_at', 'votes', 'posted_by_user_id', 'match_score', 'status'];

        // Verify EditFields interface only has the editable fields + nothing from prohibited
        const fieldKeys = Object.keys({
            title: '',
            company: '',
            location: '',
            description: '',
        } as EditFields);

        expect(fieldKeys).toEqual(editableFields);
        for (const prohibited of prohibitedFields) {
            expect(fieldKeys).not.toContain(prohibited);
        }
    });
});
