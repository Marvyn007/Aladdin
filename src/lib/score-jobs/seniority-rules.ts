/**
 * Score Jobs Pipeline - Seniority & Industry Rules
 * 
 * Deterministic rules for mapping job titles and experience to seniority levels.
 * Falls back to rules when LLM confidence is low.
 */

import type { SeniorityLevel } from '@/types';

// ============================================================================
// SENIORITY MAPPING RULES
// ============================================================================

interface SeniorityRule {
  keywords: string[];
  seniority: SeniorityLevel;
  confidence: number;
}

const SENIORITY_RULES: SeniorityRule[] = [
  // Intern
  { keywords: ['intern', 'internship', 'co-op', 'co op', 'trainee'], seniority: 'intern', confidence: 0.95 },
  
  // Entry / Junior
  { keywords: ['junior', 'jr', 'jr.', 'entry', 'entry level', 'entry-level', 'new grad', 'new graduate', 'graduate', 'associate'], seniority: 'junior', confidence: 0.90 },
  
  // Mid
  { keywords: ['mid', 'mid-level', 'mid level', 'engineer', 'developer', 'programmer'], seniority: 'mid', confidence: 0.70 },
  
  // Senior
  { keywords: ['senior', 'sr', 'sr.', 'senior engineer', 'senior developer', 'senior programmer'], seniority: 'senior', confidence: 0.95 },
  
  // Staff
  { keywords: ['staff', 'staff engineer', 'staff developer', 'principal'], seniority: 'staff', confidence: 0.95 },
  
  // Lead
  { keywords: ['lead', 'team lead', 'tech lead', 'technical lead'], seniority: 'lead', confidence: 0.95 },
  
  // Manager
  { keywords: ['manager', 'management', 'managing', 'director of'], seniority: 'manager', confidence: 0.90 },
  
  // Director
  { keywords: ['director', 'executive', 'vp', 'vice president', 'chief', 'cto', 'ceo', 'cfo', 'coo'], seniority: 'director', confidence: 0.95 },
];

// ============================================================================
// EXPERIENCE TO SENIORITY MAPPING
// ============================================================================

interface ExperienceMapping {
  maxYears: number;
  seniority: SeniorityLevel;
}

const EXPERIENCE_MAPPINGS: ExperienceMapping[] = [
  { maxYears: 1, seniority: 'intern' },
  { maxYears: 2, seniority: 'junior' },
  { maxYears: 3, seniority: 'junior' },
  { maxYears: 5, seniority: 'mid' },
  { maxYears: 8, seniority: 'senior' },
  { maxYears: 12, seniority: 'staff' },
  { maxYears: 15, seniority: 'lead' },
  { maxYears: Infinity, seniority: 'manager' },
];

// ============================================================================
// SENIORITY ADJACENCY MATRIX
// ============================================================================

const SENIORITY_ADJACENCY: Record<SeniorityLevel, SeniorityLevel[]> = {
  intern: ['entry', 'junior'],
  entry: ['intern', 'junior', 'mid'],
  junior: ['entry', 'mid', 'associate'],
  associate: ['junior', 'mid', 'senior'],
  mid: ['junior', 'associate', 'senior', 'staff'],
  senior: ['mid', 'staff', 'lead'],
  staff: ['senior', 'lead', 'manager'],
  lead: ['senior', 'staff', 'manager', 'director'],
  manager: ['lead', 'director', 'executive'],
  director: ['manager', 'executive'],
  executive: ['director'],
};

// Seniority order for numeric comparison
const SENIORITY_ORDER: Record<SeniorityLevel, number> = {
  intern: 1,
  entry: 2,
  junior: 3,
  associate: 4,
  mid: 5,
  senior: 6,
  staff: 7,
  lead: 8,
  manager: 9,
  director: 10,
  executive: 11,
};

// ============================================================================
// EXPORTED FUNCTIONS
// ============================================================================

/**
 * Determine seniority from job title using deterministic rules
 */
export function determineSeniorityFromTitle(
  jobTitle: string,
  llmExtraction: string | null,
  llmConfidence: number
): { seniority: SeniorityLevel | null; confidence: number } {
  // If LLM extraction is confident, use it
  if (llmExtraction && llmConfidence >= 0.8) {
    const parsed = parseSeniorityString(llmExtraction);
    if (parsed) {
      return { seniority: parsed, confidence: llmConfidence };
    }
  }

  // Fall back to deterministic rules
  const titleLower = jobTitle.toLowerCase();

  for (const rule of SENIORITY_RULES) {
    for (const keyword of rule.keywords) {
      if (titleLower.includes(keyword)) {
        return {
          seniority: rule.seniority,
          confidence: rule.confidence
        };
      }
    }
  }

  return { seniority: null, confidence: 0 };
}

/**
 * Determine seniority from years of experience
 */
export function determineSeniorityFromExperience(
  yearsExperience: number | null
): { seniority: SeniorityLevel; confidence: number } {
  if (yearsExperience === null || yearsExperience === undefined) {
    return { seniority: 'mid', confidence: 0.3 };
  }

  for (const mapping of EXPERIENCE_MAPPINGS) {
    if (yearsExperience <= mapping.maxYears) {
      return { seniority: mapping.seniority, confidence: 0.8 };
    }
  }

  return { seniority: 'manager', confidence: 0.8 };
}

/**
 * Calculate seniority match score between candidate and job
 */
export function calculateSeniorityMatch(
  candidateSeniority: SeniorityLevel | null,
  jobSeniority: SeniorityLevel | null,
  candidateYears: number | null,
  jobSeniorityConfidence: number
): { score: number; isMatch: boolean; isAdjacent: boolean } {
  // If either is unknown, return neutral score
  if (!candidateSeniority || !jobSeniority) {
    // Try to infer from experience if available
    if (candidateYears !== null && jobSeniority) {
      const inferred = determineSeniorityFromExperience(candidateYears);
      return calculateSeniorityMatch(
        inferred.seniority,
        jobSeniority,
        candidateYears,
        jobSeniorityConfidence
      );
    }
    return { score: 0.5, isMatch: false, isAdjacent: false };
  }

  // Exact match
  if (candidateSeniority === jobSeniority) {
    return { score: 1.0, isMatch: true, isAdjacent: false };
  }

  // Check adjacency
  const adjacent = SENIORITY_ADJACENCY[jobSeniority] || [];
  if (adjacent.includes(candidateSeniority)) {
    return { score: 0.7, isMatch: false, isAdjacent: true };
  }

  // Mismatch - check if candidate is overqualified
  const candidateOrder = SENIORITY_ORDER[candidateSeniority] || 0;
  const jobOrder = SENIORITY_ORDER[jobSeniority] || 0;
  
  if (candidateOrder > jobOrder) {
    // Overqualified - slight penalty but not zero
    return { score: 0.3, isMatch: false, isAdjacent: false };
  }

  // Underqualified
  return { score: 0, isMatch: false, isAdjacent: false };
}

/**
 * Calculate experience match score
 */
export function calculateExperienceMatch(
  candidateYears: number | null,
  jobRequiredYears: number | null
): { score: number; meetsRequirement: boolean } {
  // If job doesn't specify, neutral match
  if (jobRequiredYears === null) {
    return { score: 1.0, meetsRequirement: true };
  }

  // If candidate experience unknown, can't determine
  if (candidateYears === null) {
    return { score: 0.5, meetsRequirement: false };
  }

  // Meets or exceeds requirement
  if (candidateYears >= jobRequiredYears) {
    return { score: 1.0, meetsRequirement: true };
  }

  // Partial match based on ratio
  const ratio = candidateYears / jobRequiredYears;
  return { score: Math.min(ratio, 1.0), meetsRequirement: false };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Parse LLM seniority string to enum
 */
function parseSeniorityString(seniority: string): SeniorityLevel | null {
  const normalized = seniority.toLowerCase().trim();

  const mapping: Record<string, SeniorityLevel> = {
    'intern': 'intern',
    'internship': 'intern',
    'entry': 'entry',
    'entry level': 'entry',
    'junior': 'junior',
    'jr': 'junior',
    'jr.': 'junior',
    'associate': 'associate',
    'mid': 'mid',
    'mid-level': 'mid',
    'senior': 'senior',
    'sr': 'senior',
    'sr.': 'senior',
    'staff': 'staff',
    'principal': 'staff',
    'lead': 'lead',
    'team lead': 'lead',
    'tech lead': 'lead',
    'manager': 'manager',
    'director': 'director',
    'executive': 'executive',
    'vp': 'director',
    'vice president': 'director',
    'cto': 'executive',
    'ceo': 'executive',
  };

  return mapping[normalized] || null;
}

/**
 * Extract years of experience from job description text
 */
export function extractYearsFromDescription(description: string): number | null {
  // Common patterns for years requirements
  const patterns = [
    /(\d+)\+?\s*years?\s+(?:of\s+)?experience/i,
    /(\d+)\+?\s*yrs?\s+(?:of\s+)?experience/i,
    /minimum\s+(\d+)\s+years?/i,
    /at\s+least\s+(\d+)\s+years?/i,
    /(\d+)\s*-\s*\d+\s+years?/i,
    /(\d+)\+ years/i,
  ];

  for (const pattern of patterns) {
    const match = description.match(pattern);
    if (match) {
      const years = parseInt(match[1], 10);
      if (!isNaN(years) && years > 0 && years <= 30) {
        return years;
      }
    }
  }

  return null;
}

/**
 * Get seniority display name
 */
export function getSeniorityDisplayName(seniority: SeniorityLevel | null): string {
  if (!seniority) return 'Unknown';
  
  const displayNames: Record<SeniorityLevel, string> = {
    intern: 'Intern',
    entry: 'Entry Level',
    junior: 'Junior',
    associate: 'Associate',
    mid: 'Mid-Level',
    senior: 'Senior',
    staff: 'Staff',
    lead: 'Lead',
    manager: 'Manager',
    director: 'Director',
    executive: 'Executive',
  };

  return displayNames[seniority] || seniority;
}
