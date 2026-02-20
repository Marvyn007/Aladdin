/**
 * LinkedIn Data Merger
 *
 * Merges LinkedIn profile data into a CanonicalParsedResume.
 * Rules:
 *   - Gap-fill only: adds fields that are missing or low-confidence (< 0.5)
 *     in the resume data.
 *   - NEVER overwrites high-confidence resume fields.
 *   - Marks merged fields with source: "linkedin".
 */

import type {
    CanonicalParsedResume,
    CanonicalEducation,
    CanonicalExperience,
    CanonicalProject,
    CanonicalVolunteer,
    CanonicalCertification,
    CanonicalContactLink,
    ConfidenceField,
} from '@/types';

const LOW_CONFIDENCE_THRESHOLD = 0.5;

// ============================================================================
// MAIN MERGE
// ============================================================================

/**
 * Merge LinkedIn data into a resume's canonical parsed output.
 * Returns a NEW object (does not mutate the original).
 *
 * Only fills gaps: missing or low-confidence (< 0.5) fields.
 */
export function mergeLinkedInData(
    resumeData: CanonicalParsedResume,
    linkedinData: Partial<CanonicalParsedResume>
): CanonicalParsedResume {
    // Deep clone to avoid mutation
    const merged: CanonicalParsedResume = JSON.parse(JSON.stringify(resumeData));

    if (!linkedinData) return merged;

    // --- Name ---
    mergeConfidenceField(merged, 'name', linkedinData.name);

    // --- Summary ---
    mergeConfidenceField(merged, 'summary', linkedinData.summary);

    // --- Contacts ---
    if (linkedinData.contacts) {
        // Email
        if (isLowOrMissing(merged.contacts.email) && linkedinData.contacts.email?.value) {
            merged.contacts.email = markLinkedIn(linkedinData.contacts.email);
        }
        // Phone
        if (isLowOrMissing(merged.contacts.phone) && linkedinData.contacts.phone?.value) {
            merged.contacts.phone = markLinkedIn(linkedinData.contacts.phone);
        }
        // Location
        if (isLowOrMissing(merged.contacts.location) && linkedinData.contacts.location?.value) {
            merged.contacts.location = markLinkedIn(linkedinData.contacts.location);
        }
        // Links
        if (linkedinData.contacts.links) {
            mergeLinks(merged.contacts.links, linkedinData.contacts.links);
        }
    }

    // --- Education ---
    if (linkedinData.education?.length) {
        mergeArraySection(merged.education, linkedinData.education, educationKey);
    }

    // --- Experience ---
    if (linkedinData.experience?.length) {
        mergeArraySection(merged.experience, linkedinData.experience, experienceKey);
    }

    // --- Projects ---
    if (linkedinData.projects?.length) {
        mergeArraySection(merged.projects, linkedinData.projects, projectKey);
    }

    // --- Volunteer ---
    if (linkedinData.volunteer?.length) {
        mergeArraySection(merged.volunteer, linkedinData.volunteer, volunteerKey);
    }

    // --- Skills ---
    if (linkedinData.skills) {
        mergeSkills(merged, linkedinData.skills);
    }

    // --- Certifications ---
    if (linkedinData.certifications?.length) {
        mergeArraySection(merged.certifications, linkedinData.certifications, certKey);
    }

    return merged;
}

// ============================================================================
// HELPERS
// ============================================================================

/** Check if a ConfidenceField is missing or below threshold. */
function isLowOrMissing(field: ConfidenceField<string | null> | undefined): boolean {
    if (!field) return true;
    if (!field.value) return true;
    return field.confidence < LOW_CONFIDENCE_THRESHOLD;
}

/** Mark a ConfidenceField as sourced from LinkedIn. */
function markLinkedIn<T>(field: ConfidenceField<T>): ConfidenceField<T> {
    return { ...field, source: 'linkedin' };
}

/** Merge a top-level ConfidenceField if the resume version is missing/low. */
function mergeConfidenceField(
    merged: CanonicalParsedResume,
    key: 'name' | 'summary',
    linkedinField?: ConfidenceField<string | null>
): void {
    if (!linkedinField?.value) return;
    const resumeField = merged[key];
    if (isLowOrMissing(resumeField)) {
        merged[key] = markLinkedIn(linkedinField);
    }
}

/** Merge link arrays, avoiding duplicates by URL. */
function mergeLinks(
    resumeLinks: CanonicalContactLink[],
    linkedinLinks: CanonicalContactLink[]
): void {
    const existingUrls = new Set(resumeLinks.map(l => l.url.toLowerCase()));
    for (const link of linkedinLinks) {
        if (!existingUrls.has(link.url.toLowerCase())) {
            resumeLinks.push({ ...link, confidence: link.confidence });
        }
    }
}

// --- Keying functions for deduplication ---

function educationKey(e: CanonicalEducation): string {
    return `${(e.institution ?? '').toLowerCase()}|${(e.degree ?? '').toLowerCase()}`;
}

function experienceKey(e: CanonicalExperience): string {
    return `${(e.company ?? '').toLowerCase()}|${(e.title ?? '').toLowerCase()}`;
}

function projectKey(p: CanonicalProject): string {
    return (p.name ?? '').toLowerCase();
}

function volunteerKey(v: CanonicalVolunteer): string {
    return (v.organization ?? '').toLowerCase();
}

function certKey(c: CanonicalCertification): string {
    return (c.name ?? '').toLowerCase();
}

/**
 * Merge an array section: add LinkedIn items that don't already exist
 * in the resume data (by key).
 */
function mergeArraySection<T extends { source?: string }>(
    resumeArr: T[],
    linkedinArr: T[],
    keyFn: (item: T) => string
): void {
    const existingKeys = new Set(resumeArr.map(keyFn));
    for (const item of linkedinArr) {
        if (!existingKeys.has(keyFn(item))) {
            resumeArr.push({ ...item, source: 'linkedin' } as T);
        }
    }
}

/** Merge skills: add LinkedIn skills not already in the resume's lists. */
function mergeSkills(
    merged: CanonicalParsedResume,
    linkedinSkills: CanonicalParsedResume['skills']
): void {
    if (!linkedinSkills) return;

    const existingExplicit = new Set(
        merged.skills.explicit_list.map(s => s.toLowerCase())
    );
    const existingInferred = new Set(
        merged.skills.inferred_from_text.map(s => s.toLowerCase())
    );

    for (const skill of linkedinSkills.explicit_list ?? []) {
        if (!existingExplicit.has(skill.toLowerCase()) && !existingInferred.has(skill.toLowerCase())) {
            merged.skills.explicit_list.push(skill);
        }
    }

    for (const skill of linkedinSkills.inferred_from_text ?? []) {
        if (!existingExplicit.has(skill.toLowerCase()) && !existingInferred.has(skill.toLowerCase())) {
            merged.skills.inferred_from_text.push(skill);
        }
    }
}
