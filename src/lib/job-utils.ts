// Utility functions for job processing (validation, normalization)
// Pure logic, no heavy dependencies.

// Normalize text for comparison and hashing
export function normalizeText(text: string): string {
    return text
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
        .trim();
}

// Check if job title/description indicates internship or entry-level
export function isInternshipOrEntryLevel(title: string, description: string = ''): boolean {
    const combined = `${title} ${description}`.toLowerCase();

    const keywords = [
        'intern',
        'internship',
        'entry-level',
        'entry level',
        'new grad',
        'newgrad',
        'junior',
        'associate',
        'graduate',
        'recent graduate',
        'early career',
        'i ',  // Level I
        ' i,',
        ' 1 ',
        'level 1',
        'level i',
    ];

    return keywords.some(keyword => combined.includes(keyword));
}

// Check if job is located in US
export function isUSLocation(location: string | null): boolean {
    if (!location) return true; // Allow if no location (might be remote)

    const normalized = location.toLowerCase();

    // Common US indicators
    const usIndicators = [
        'united states',
        'usa',
        'u.s.',
        'u.s.a.',
        'remote',
        // State abbreviations
        ', al', ', ak', ', az', ', ar', ', ca', ', co', ', ct', ', de', ', fl', ', ga',
        ', hi', ', id', ', il', ', in', ', ia', ', ks', ', ky', ', la', ', me', ', md',
        ', ma', ', mi', ', mn', ', ms', ', mo', ', mt', ', ne', ', nv', ', nh', ', nj',
        ', nm', ', ny', ', nc', ', nd', ', oh', ', ok', ', or', ', pa', ', ri', ', sc',
        ', sd', ', tn', ', tx', ', ut', ', vt', ', va', ', wa', ', wv', ', wi', ', wy',
        ', dc',
        // Full state names
        'california', 'texas', 'new york', 'florida', 'washington', 'colorado',
        'massachusetts', 'illinois', 'pennsylvania', 'ohio', 'georgia', 'north carolina',
        'virginia', 'michigan', 'arizona', 'oregon', 'seattle', 'san francisco',
        'los angeles', 'chicago', 'boston', 'austin', 'denver', 'atlanta',
    ];

    return usIndicators.some(indicator => normalized.includes(indicator));
}

// Check if job is software engineering related
export function isSoftwareEngineeringRole(title: string, description: string = ''): boolean {
    const combined = `${title} ${description}`.toLowerCase();

    const keywords = [
        'software',
        'engineer',
        'developer',
        'programming',
        'coding',
        'frontend',
        'front-end',
        'front end',
        'backend',
        'back-end',
        'back end',
        'full stack',
        'fullstack',
        'full-stack',
        'web developer',
        'mobile developer',
        'ios developer',
        'android developer',
        'devops',
        'sre',
        'site reliability',
        'platform engineer',
        'data engineer',
        'ml engineer',
        'machine learning engineer',
        'ai engineer',
    ];

    return keywords.some(keyword => combined.includes(keyword));
}

// Validate job meets all criteria
export function validateJobCriteria(
    title: string,
    description: string,
    location: string | null
): { valid: boolean; reason?: string } {
    if (!isSoftwareEngineeringRole(title, description)) {
        return { valid: false, reason: 'Not a software engineering role' };
    }

    if (!isInternshipOrEntryLevel(title, description)) {
        return { valid: false, reason: 'Not internship or entry-level' };
    }

    if (!isUSLocation(location)) {
        return { valid: false, reason: 'Not a US location' };
    }

    return { valid: true };
}
