/**
 * Job Validation Module
 * 
 * Centralized validation for all job ingestion paths:
 * - Import Job API (URL and text-based)
 * - API source adapters (SerpAPI, RapidAPI, USAJobs)
 * - Database insertion
 * 
 * Ensures fail-fast behavior: only jobs with complete, usable descriptions pass validation.
 */

import { ScrapeResult } from './job-scraper-fetch';

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Domains where job scraping is restricted or legally unsafe
 */
export const BLOCKED_DOMAINS = [
    'linkedin.com',
    'indeed.com',
    'glassdoor.com',
] as const;

/**
 * Minimum required length for job descriptions
 */
export const MIN_DESCRIPTION_LENGTH = 3000;

/**
 * Minimum confidence thresholds for scraped job data
 */
export const CONFIDENCE_THRESHOLDS = {
    description: 0.6,
    date: 0.5,
    location: 0.4,
} as const;

/**
 * Placeholder text patterns that indicate incomplete descriptions
 */
const PLACEHOLDER_PATTERNS = [
    /view full description/i,
    /click to apply/i,
    /please log in/i,
    /sign in to view/i,
    /login to continue/i,
    /view complete details/i,
    /see full details/i,
] as const;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface DomainValidationResult {
    valid: boolean;
    blockedDomain?: string;
}

export interface DescriptionValidationResult {
    valid: boolean;
    reason?: string;
    length?: number;
}

export interface ScrapeValidationResult {
    valid: boolean;
    reasons: string[];
}

export interface ValidationInput {
    domainValidation?: DomainValidationResult;
    descriptionValidation?: DescriptionValidationResult;
    scrapeValidation?: ScrapeValidationResult;
}

// ============================================================================
// DOMAIN VALIDATION
// ============================================================================

/**
 * Validate that a job URL is not from a blocked domain
 * 
 * @param url - Job posting URL to validate
 * @returns Validation result with blocked domain name if invalid
 */
export function validateJobSourceDomain(url: string): DomainValidationResult {
    try {
        const hostname = new URL(url).hostname.replace('www.', '').toLowerCase();

        for (const blockedDomain of BLOCKED_DOMAINS) {
            if (hostname === blockedDomain || hostname.endsWith(`.${blockedDomain}`)) {
                return {
                    valid: false,
                    blockedDomain: blockedDomain,
                };
            }
        }

        return { valid: true };
    } catch {
        return {
            valid: false,
            blockedDomain: 'invalid URL',
        };
    }
}

// ============================================================================
// DESCRIPTION VALIDATION
// ============================================================================

/**
 * Validate that a job description meets quality requirements:
 * - Not empty
 * - Meets minimum length (3000 chars)
 * - Not truncated
 * - Doesn't contain placeholder text
 * 
 * @param description - Job description text to validate
 * @returns Validation result with specific reason if invalid
 */
export function validateJobDescription(description: string): DescriptionValidationResult {
    const trimmedDesc = description?.trim() || '';

    // Check 1: Not empty
    if (!trimmedDesc || trimmedDesc.length === 0) {
        return {
            valid: false,
            reason: 'Job description is empty',
            length: 0,
        };
    }

    // Check 2: Minimum length
    if (trimmedDesc.length < MIN_DESCRIPTION_LENGTH) {
        return {
            valid: false,
            reason: `Job description too short (${trimmedDesc.length} characters, minimum ${MIN_DESCRIPTION_LENGTH})`,
            length: trimmedDesc.length,
        };
    }

    // Check 3: Placeholder text
    for (const pattern of PLACEHOLDER_PATTERNS) {
        if (pattern.test(trimmedDesc)) {
            return {
                valid: false,
                reason: 'Job description contains placeholder text (e.g., "view full description"). Please paste complete job description.',
                length: trimmedDesc.length,
            };
        }
    }

    // Check 4: Truncation patterns
    const truncationPatterns = [
        /\.{3,}$/,
        /…$/,
        /read more$/i,
        /see full description$/i,
        /click to expand$/i,
    ];

    for (const pattern of truncationPatterns) {
        if (pattern.test(trimmedDesc.trim())) {
            return {
                valid: false,
                reason: 'Job description appears truncated or incomplete. Please use full job posting.',
                length: trimmedDesc.length,
            };
        }
    }

    return {
        valid: true,
        length: trimmedDesc.length,
    };
}

// ============================================================================
// SCRAPE RESULT VALIDATION
// ============================================================================

/**
 * Validate that a scraped job result meets quality thresholds
 * 
 * @param result - Scrape result from job scraper
 * @returns Validation result with list of reasons if invalid
 */
export function validateJobScrapeResult(result: ScrapeResult): ScrapeValidationResult {
    const reasons: string[] = [];

    // Warn but do not fail on confidence issues
    if (result.confidence.description < CONFIDENCE_THRESHOLDS.description) {
        console.warn(`[Validation] Low description confidence (${(result.confidence.description * 100).toFixed(0)}%) - allowing anyway`);
    }

    if (result.confidence.date < CONFIDENCE_THRESHOLDS.date) {
        console.warn(`[Validation] Low date confidence (${(result.confidence.date * 100).toFixed(0)}%) - allowing anyway`);
    }

    if (result.confidence.location < CONFIDENCE_THRESHOLDS.location) {
        console.warn(`[Validation] Low location confidence (${(result.confidence.location * 100).toFixed(0)}%) - allowing anyway`);
    }

    // Always return valid to allow all imports as requested by user
    return {
        valid: true,
        reasons,
    };
}

// ============================================================================
// ERROR MESSAGE GENERATION
// ============================================================================

/**
 * Generate user-friendly error message from validation results
 * 
 * @param input - Validation results from various stages
 * @returns User-readable error message
 */
export function getValidationErrorMessage(input: ValidationInput): string {
    // Priority 1: Domain validation errors
    if (input.domainValidation && !input.domainValidation.valid) {
        const domain = input.domainValidation.blockedDomain;
        return `Jobs cannot be fetched from ${domain}. Please use the original job posting link or paste the job description manually.`;
    }

    // Priority 2: Description validation errors
    if (input.descriptionValidation && !input.descriptionValidation.valid) {
        return input.descriptionValidation.reason || 'Invalid job description';
    }

    // Priority 3: Scrape validation errors
    if (input.scrapeValidation && !input.scrapeValidation.valid) {
        if (input.scrapeValidation.reasons.length === 1) {
            return input.scrapeValidation.reasons[0];
        }

        const reasons = input.scrapeValidation.reasons.join('; ');
        return `Unable to extract complete job information from this page. Issues: ${reasons}. Please verify the job posting link or paste the description manually.`;
    }

    // Fallback
    return 'Job validation failed';
}
