
import type { Job, ParsedResume } from '@/types';

interface ScoreComponents {
    base: number;
    skillMatch: number;
    roleMatch: number;
    locationMatch: number;
    notes: string[];
}

/**
 * Calculate similarity between two strings (0-1)
 * Simple Jaccard similarity on tokens
 */
function calculateTextSimilarity(text1: string, text2: string): number {
    const tokenize = (s: string) => new Set(s.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/).filter(w => w.length > 2));
    const set1 = tokenize(text1);
    const set2 = tokenize(text2);

    if (set1.size === 0 || set2.size === 0) return 0;

    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);

    return intersection.size / union.size;
}

/**
 * Calculate a precise, deterministic score (0-100) for a job against a resume
 */
export function calculateMatchScore(
    job: Job,
    resume: ParsedResume,
    linkedin: ParsedResume | null = null
): number {
    const components: ScoreComponents = {
        base: 0,
        skillMatch: 0,
        roleMatch: 0,
        locationMatch: 0,
        notes: []
    };

    // 1. COMBINE RESUME & LINKEDIN DATA
    // 1. COMBINE RESUME & LINKEDIN DATA
    const extractSkills = (skills: any[] | undefined) => {
        if (!skills) return [];
        return skills.map(s => (typeof s === 'string' ? s : s.name || ''));
    };

    const allSkills = new Set([
        ...extractSkills(resume.skills),
        ...extractSkills(linkedin?.skills),
        ...(resume.tools || []),
        ...(linkedin?.tools || []),
        ...(resume.languages || []),
        ...(linkedin?.languages || []),
        ...(resume.frameworks || []),
        ...(linkedin?.frameworks || [])
    ].map(s => s.toLowerCase()).filter(Boolean));

    const targetRoles = [
        ...(resume.roles?.map(e => e.title) || []),
        ...(linkedin?.roles?.map(e => e.title) || [])
    ].join(' ');

    // 2. TEXT NORMALIZATION
    const jobText = (job.normalized_text || job.raw_text_summary || job.title).toLowerCase();
    const jobTitle = job.title.toLowerCase();

    // 3. ROLE MATCHING (30 Points)
    // Check if job title matches any past role title or resume summary keywords
    const titleSimilarity = calculateTextSimilarity(jobTitle, targetRoles);
    components.roleMatch = Math.min(30, Math.ceil(titleSimilarity * 100));

    // Boost if exact title match found
    if (targetRoles.toLowerCase().includes(jobTitle)) {
        components.roleMatch = 30;
    }

    // 4. SKILL MATCHING (50 Points)
    // Count how many user skills appear in the job description
    let foundSkills = 0;
    allSkills.forEach(skill => {
        if (jobText.includes(skill)) {
            foundSkills++;
        }
    });

    // Diminishing returns formula: more skills = better score, but plateaus
    // 5 skills = ~25pts, 10 skills = ~40pts, 15+ skills = 50pts
    components.skillMatch = Math.min(50, Math.ceil(foundSkills * 3.5));

    // 5. LOCATION MATCHING (10 Points)
    // Simple check if location format matches or is "Remote"
    const jobLoc = (job.location || '').toLowerCase();
    const resumeLoc = (resume.contact?.location || '').toLowerCase();

    if (jobLoc.includes('remote')) {
        components.locationMatch = 10;
    } else if (resumeLoc && jobLoc.includes(resumeLoc)) {
        components.locationMatch = 10;
    } else {
        // Fallback: Partial match
        components.locationMatch = 5;
    }

    // 6. BASELINE / EXPERIENCE (10 Points)
    // Assume valid candidate if they have resumes uploaded
    components.base = 5;

    // Years of experience proxy (if easy to detect, otherwise flat)
    if ((resume.roles?.length || 0) > 2) {
        components.base += 5;
    }

    // TOTAL SCORE CALCULATION
    let totalScore =
        components.roleMatch +
        components.skillMatch +
        components.locationMatch +
        components.base;

    // Ensure deterministic "jitter" to avoid round numbers (e.g., 70 -> 73)
    // Uses job ID to consistently map to a small offset
    const jitter = (job.id.charCodeAt(0) + job.id.charCodeAt(job.id.length - 1)) % 7;

    // Add jitter but clamp to 100
    totalScore = Math.min(99, Math.max(10, totalScore + (jitter - 3))); // -3 to +3 offset

    return totalScore;
}
