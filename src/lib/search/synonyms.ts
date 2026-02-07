/**
 * Job Search Synonyms
 * 
 * This module provides comprehensive synonym mappings for job search queries.
 * Synonyms help users find relevant jobs even when using different terminology.
 */

// Common job title synonyms and abbreviations
export const TITLE_SYNONYMS: Record<string, string[]> = {
    // Software Engineering
    'swe': ['software engineer', 'software developer', 'developer', 'programmer'],
    'sde': ['software development engineer', 'software engineer', 'developer'],
    'dev': ['developer', 'software developer', 'engineer'],
    'coder': ['programmer', 'developer', 'software engineer'],

    // Frontend
    'frontend': ['front-end', 'front end', 'ui developer', 'ui engineer', 'client-side'],
    'front-end': ['frontend', 'front end', 'ui developer', 'ui engineer'],
    'ui': ['frontend', 'user interface', 'front-end'],
    'react': ['frontend developer', 'react developer', 'ui engineer'],
    'vue': ['frontend developer', 'vue developer', 'ui engineer'],
    'angular': ['frontend developer', 'angular developer', 'ui engineer'],

    // Backend
    'backend': ['back-end', 'back end', 'server-side', 'api developer'],
    'back-end': ['backend', 'back end', 'server-side'],
    'api': ['backend', 'backend developer', 'api developer'],

    // Full Stack
    'fullstack': ['full-stack', 'full stack', 'full-stack developer'],
    'full-stack': ['fullstack', 'full stack'],
    'full stack': ['fullstack', 'full-stack'],

    // DevOps / Infrastructure
    'devops': ['dev ops', 'site reliability', 'sre', 'platform engineer', 'infrastructure'],
    'sre': ['site reliability engineer', 'devops', 'platform engineer'],
    'infra': ['infrastructure', 'platform', 'devops'],
    'cloud': ['aws', 'azure', 'gcp', 'cloud engineer', 'devops'],

    // Data
    'data scientist': ['ml engineer', 'machine learning', 'data science', 'ds'],
    'ds': ['data scientist', 'data science'],
    'ml': ['machine learning', 'ml engineer', 'ai engineer', 'data scientist'],
    'ai': ['artificial intelligence', 'machine learning', 'ml engineer'],
    'data engineer': ['data engineering', 'etl developer', 'big data'],
    'da': ['data analyst', 'business analyst', 'analytics'],
    'analyst': ['data analyst', 'business analyst', 'analytics'],

    // Mobile
    'mobile': ['ios', 'android', 'mobile developer', 'app developer'],
    'ios': ['swift developer', 'iphone developer', 'mobile developer', 'apple'],
    'android': ['kotlin developer', 'mobile developer', 'java mobile'],

    // Experience Levels
    'intern': ['internship', 'summer intern', 'co-op', 'trainee'],
    'internship': ['intern', 'summer intern', 'co-op'],
    'junior': ['jr', 'entry level', 'entry-level', 'associate', 'new grad'],
    'jr': ['junior', 'entry level', 'associate'],
    'entry level': ['entry-level', 'junior', 'new grad', 'associate'],
    'new grad': ['entry level', 'junior', 'graduate', 'recent graduate'],
    'senior': ['sr', 'lead', 'principal', 'staff'],
    'sr': ['senior', 'lead'],
    'lead': ['senior', 'tech lead', 'team lead', 'principal'],
    'staff': ['senior staff', 'principal', 'distinguished'],

    // Roles
    'pm': ['product manager', 'project manager', 'program manager'],
    'product manager': ['pm', 'product owner', 'product lead'],
    'project manager': ['pm', 'program manager', 'scrum master'],
    'ux': ['user experience', 'ux designer', 'product designer'],
    'ui/ux': ['ux designer', 'ui designer', 'product designer'],
    'designer': ['ux designer', 'ui designer', 'product designer', 'graphic designer'],
    'qa': ['quality assurance', 'tester', 'sdet', 'test engineer'],
    'sdet': ['software development engineer in test', 'qa engineer', 'test engineer'],
    'security': ['cybersecurity', 'infosec', 'security engineer'],

    // Technology-specific
    'python': ['python developer', 'django developer', 'flask developer'],
    'java': ['java developer', 'spring developer', 'backend developer'],
    'javascript': ['js developer', 'node developer', 'frontend developer'],
    'js': ['javascript', 'node.js', 'frontend'],
    'typescript': ['ts', 'javascript', 'frontend developer'],
    'ts': ['typescript', 'javascript'],
    'golang': ['go developer', 'go', 'backend developer'],
    'go': ['golang', 'go developer'],
    'rust': ['rust developer', 'systems programmer'],
    'cpp': ['c++', 'c++ developer', 'systems programmer'],
    'c++': ['cpp', 'c++ developer'],
};

// Location synonyms
export const LOCATION_SYNONYMS: Record<string, string[]> = {
    'remote': ['work from home', 'wfh', 'distributed', 'virtual', 'anywhere'],
    'wfh': ['remote', 'work from home', 'virtual'],
    'sf': ['san francisco', 'bay area', 'california'],
    'san francisco': ['sf', 'bay area'],
    'bay area': ['san francisco', 'sf', 'silicon valley', 'california'],
    'nyc': ['new york', 'new york city', 'manhattan'],
    'new york': ['nyc', 'new york city', 'manhattan'],
    'la': ['los angeles', 'california'],
    'los angeles': ['la', 'california'],
    'dc': ['washington dc', 'washington d.c.', 'dmv'],
    'seattle': ['wa', 'washington'],
    'boston': ['ma', 'massachusetts'],
    'austin': ['tx', 'texas'],
    'chicago': ['il', 'illinois'],
    'denver': ['co', 'colorado'],
    'atlanta': ['ga', 'georgia'],
};

// Company type synonyms
export const COMPANY_SYNONYMS: Record<string, string[]> = {
    'faang': ['google', 'amazon', 'facebook', 'meta', 'apple', 'netflix', 'big tech'],
    'big tech': ['faang', 'google', 'amazon', 'microsoft', 'meta', 'apple'],
    'startup': ['early stage', 'seed', 'series a', 'growth stage'],
    'fintech': ['financial technology', 'payments', 'banking tech'],
    'healthtech': ['health tech', 'healthcare technology', 'medtech'],
};

/**
 * Get all synonyms for a given term
 */
export function getSynonyms(term: string): string[] {
    const normalizedTerm = term.toLowerCase().trim();

    // Check all synonym maps
    const titleSyns = TITLE_SYNONYMS[normalizedTerm] || [];
    const locationSyns = LOCATION_SYNONYMS[normalizedTerm] || [];
    const companySyns = COMPANY_SYNONYMS[normalizedTerm] || [];

    return [...new Set([...titleSyns, ...locationSyns, ...companySyns])];
}

/**
 * Expand a query with synonyms for better search coverage
 * Returns the original query plus variations with synonyms
 */
export function expandQueryWithSynonyms(query: string): string[] {
    const normalizedQuery = query.toLowerCase().trim();
    const tokens = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    const expandedQueries: Set<string> = new Set([normalizedQuery]);

    // For each token, try to find synonyms
    tokens.forEach((token, index) => {
        const synonyms = getSynonyms(token);

        if (synonyms.length > 0) {
            // Create variations with each synonym
            synonyms.forEach(syn => {
                const newTokens = [...tokens];
                newTokens[index] = syn;
                expandedQueries.add(newTokens.join(' '));
            });
        }
    });

    // Also try the whole query as a phrase
    const phraseSynonyms = getSynonyms(normalizedQuery);
    phraseSynonyms.forEach(syn => expandedQueries.add(syn));

    return Array.from(expandedQueries);
}

/**
 * Get search suggestions based on partial input with synonym awareness
 */
export function getSynonymSuggestions(partialQuery: string): string[] {
    const normalized = partialQuery.toLowerCase().trim();
    const suggestions: string[] = [];

    // Find matching synonym keys
    const allKeys = [
        ...Object.keys(TITLE_SYNONYMS),
        ...Object.keys(LOCATION_SYNONYMS),
        ...Object.keys(COMPANY_SYNONYMS),
    ];

    allKeys.forEach(key => {
        if (key.startsWith(normalized) || key.includes(normalized)) {
            suggestions.push(key);
        }
    });

    return [...new Set(suggestions)].slice(0, 5);
}

/**
 * Check if a term is an abbreviation that should be expanded
 */
export function isAbbreviation(term: string): boolean {
    const normalized = term.toLowerCase().trim();
    const abbreviations = ['swe', 'sde', 'pm', 'qa', 'sre', 'ml', 'ai', 'ds', 'da', 'jr', 'sr', 'ui', 'ux'];
    return abbreviations.includes(normalized) || normalized.length <= 3;
}

/**
 * Get the primary expansion for an abbreviation
 */
export function getPrimaryExpansion(abbreviation: string): string | null {
    const normalized = abbreviation.toLowerCase().trim();
    const synonyms = TITLE_SYNONYMS[normalized];
    return synonyms && synonyms.length > 0 ? synonyms[0] : null;
}
