import { describe, expect, it } from 'vitest';
import { extractJobCardTags } from '@/lib/job-card-tags';

describe('extractJobCardTags', () => {
    it('extracts high-confidence card tags from structured data and description text', () => {
        const tags = extractJobCardTags({
            title: 'Software Engineering Intern',
            job_description_plain: `
                Join our Summer 2026 internship program.
                This is a full-time internship with an hourly pay rate of $28 - $32/hr.
                Interns will work 3 days a week in person at our San Jose office.
            `,
            location_display: 'San Jose, CA, USA',
            salaryMin: 28,
            salaryMax: 32,
            salaryCurrency: 'USD',
            jobType: 'internship',
        });

        expect(tags.map((tag) => tag.label)).toEqual([
            'Summer 2026',
            'Internship',
            'Full-time',
            '$28/hr',
            'San Jose, CA, USA',
            'Hybrid',
        ]);
    });

    it('uses reliable structured metadata while avoiding inferred compensation without explicit numbers', () => {
        const tags = extractJobCardTags({
            title: 'Backend Engineer',
            job_description_plain: 'Annual salary range applies to this remote role.',
            location_display: 'Remote (US)',
            salaryMin: 126163,
            salaryMax: 157504,
            salaryCurrency: 'USD',
            jobType: 'fulltime',
            isRemote: true,
            experienceLevel: 'senior',
        });

        expect(tags.map((tag) => tag.label)).toEqual([
            'Full-time',
            'Senior',
            'US',
            'Remote',
        ]);
    });

    it('avoids inventing tags from similar but non-matching words', () => {
        const tags = extractJobCardTags({
            title: 'Software Engineer',
            job_description_plain: `
                Build internal tools for contract lifecycle management.
                Collaborate across teams and improve developer workflows.
            `,
            location_display: 'Chicago, IL',
        });

        expect(tags.map((tag) => tag.label)).toEqual(['Chicago, IL']);
    });

    it('does not infer compensation without explicit pay context', () => {
        const tags = extractJobCardTags({
            title: 'Mental Health Therapist',
            job_description_plain: `
                Competitive base pay for session work.
                You will receive 4 weeks vacation and 40 hours of onboarding.
                We collaborate with industry leaders across healthcare.
            `,
            location_display: 'United States',
            salaryMin: 4,
            salaryCurrency: 'USD',
        });

        expect(tags.map((tag) => tag.label)).toEqual(['United States']);
    });

    it('does not add lead for internship roles', () => {
        const tags = extractJobCardTags({
            title: 'Accounting Intern, Statutory Reporting',
            job_description_plain: `
                Work closely with industry leaders and accounting managers.
                This is a full-time internship.
            `,
            location_display: 'United States',
            jobType: 'internship',
        });

        expect(tags.map((tag) => tag.label)).toEqual(['Internship', 'Full-time', 'United States']);
    });
});
