/**
 * Score Jobs Pipeline - Scoring Formula
 * 
 * Computes explainable match scores (0-100) with component breakdown.
 * Uses deterministic math - no LLM for scoring.
 */

import type {
  JobExtractionResult,
  CandidateProfile,
  ExtractedSkill,
  CandidateSkill,
  ScoreBreakdownV2,
  MatchedSkill,
  ScoreResultV2,
  SeniorityLevel
} from '@/types';
import { matchSkillWithFallback, industriesMatch } from './skill-normalization';
import {
  determineSeniorityFromTitle,
  determineSeniorityFromExperience,
  calculateSeniorityMatch,
  calculateExperienceMatch,
  extractYearsFromDescription
} from './seniority-rules';

// ============================================================================
// WEIGHTS CONFIGURATION
// ============================================================================

const SCORE_WEIGHTS = {
  skills: 0.50,
  seniority: 0.20,
  industry: 0.15,
  experience: 0.08,
  education: 0.03,
  location: 0.04,
};

// ============================================================================
// MAIN SCORING FUNCTION
// ============================================================================

/**
 * Compute complete score for a job-candidate pair
 */
export async function computeJobScore(
  jobId: string,
  jobDescription: string,
  jobExtraction: JobExtractionResult,
  candidate: CandidateProfile,
  location?: string
): Promise<ScoreResultV2> {
  // 1. Skills scoring
  const skillsResult = await computeSkillsScore(
    jobExtraction.skills,
    candidate.candidate_skills
  );

  // 2. Seniority scoring
  const candidateYears = candidate.years_experience_total;
  const jobYears = extractYearsFromDescription(jobDescription);
  
  // Determine job seniority (use LLM extraction or fallback)
  const jobSeniorityResult = determineSeniorityFromTitle(
    jobExtraction.job_title || '',
    jobExtraction.seniority,
    jobExtraction.seniority_confidence
  );
  
  // Determine candidate seniority
  const candidateSeniorityResult = candidate.seniority_by_experience
    ? { seniority: candidate.seniority_by_experience as SeniorityLevel, confidence: 0.8 }
    : determineSeniorityFromExperience(candidateYears);

  const seniorityMatch = calculateSeniorityMatch(
    candidateSeniorityResult.seniority,
    jobSeniorityResult.seniority,
    candidateYears,
    jobExtraction.seniority_confidence
  );

  // 3. Industry scoring
  const industryMatch = industriesMatch(
    jobExtraction.industry?.[0] || null,
    candidate.primary_industry
  );

  // 4. Experience scoring
  const experienceMatch = calculateExperienceMatch(candidateYears, jobYears);

  // 5. Education scoring (basic - only if job requires specific degree)
  const educationMatch = computeEducationMatch(jobDescription);

  // 6. Location scoring
  const locationScore = computeLocationScore(location, candidate);

  // Build breakdown
  const breakdown: ScoreBreakdownV2 = {
    skills_score: skillsResult.score,
    seniority_score: seniorityMatch.score,
    industry_score: industryMatch.score,
    experience_score: experienceMatch.score,
    education_score: educationMatch.score,
    location_score: locationScore.score,
  };

  // Calculate weighted raw score
  const rawScore =
    (breakdown.skills_score * SCORE_WEIGHTS.skills) +
    (breakdown.seniority_score * SCORE_WEIGHTS.seniority) +
    (breakdown.industry_score * SCORE_WEIGHTS.industry) +
    (breakdown.experience_score * SCORE_WEIGHTS.experience) +
    (breakdown.education_score * SCORE_WEIGHTS.education) +
    (breakdown.location_score * SCORE_WEIGHTS.location);

  // Final score rounded to 0-100
  const finalScore = Math.round(rawScore * 100);

  // Calculate confidence
  const confidence = calculateOverallConfidence(
    jobExtraction,
    candidate,
    skillsResult,
    seniorityMatch,
    industryMatch
  );

  // Generate reasons
  const reasons = generateReasons(
    skillsResult,
    seniorityMatch,
    industryMatch,
    experienceMatch,
    jobExtraction
  );

  return {
    job_id: jobId,
    score: finalScore,
    confidence,
    breakdown,
    matched_skills: skillsResult.matchedSkills,
    reasons,
    extraction_meta: {
      job_extraction_confidence: jobExtraction.seniority_confidence,
      resume_extraction_confidence: calculateCandidateConfidence(candidate),
    },
  };
}

// ============================================================================
// COMPONENT SCORING FUNCTIONS
// ============================================================================

async function computeSkillsScore(
  jobSkills: ExtractedSkill[],
  candidateSkills: CandidateSkill[]
): Promise<{
  score: number;
  matchedSkills: MatchedSkill[];
  totalWeight: number;
  matchedWeight: number;
}> {
  if (jobSkills.length === 0) {
    return { score: 1.0, matchedSkills: [], totalWeight: 0, matchedWeight: 0 };
  }

  const candidateSkillNames = candidateSkills.map(s => s.skill_name);
  let totalWeight = 0;
  let matchedWeight = 0;
  const matchedSkills: MatchedSkill[] = [];

  for (const jobSkill of jobSkills) {
    // Weight: required skills count double
    const weight = jobSkill.importance === 'required' ? 2 : 1;
    totalWeight += weight;

    const result = await matchSkillWithFallback(
      jobSkill.skill_name,
      candidateSkillNames,
      jobSkill.confidence
    );

    if (result.isMatch) {
      matchedWeight += weight;
      
      // Find candidate skill level
      const candSkill = candidateSkills.find(
        s => s.skill_name === result.matchedSkill
      );

      matchedSkills.push({
        skill_name: jobSkill.skill_name,
        job_skill_importance: jobSkill.importance,
        candidate_level: candSkill?.level || null,
        match_confidence: result.matchConfidence,
      });
    }
  }

  const score = totalWeight > 0 ? matchedWeight / totalWeight : 1.0;
  return { score, matchedSkills, totalWeight, matchedWeight };
}

function computeEducationMatch(jobDescription: string): { score: number } {
  const lowerDesc = jobDescription.toLowerCase();
  
  // Check if job explicitly requires specific education
  const hasDegreeRequirement = 
    /bachelor|master|phd|doctorate|degree|bs|ms|mba/i.test(lowerDesc);
  
  if (!hasDegreeRequirement) {
    // No specific requirement = neutral match
    return { score: 1.0 };
  }

  // If requirement exists, we assume candidate meets it (default to 1)
  // In a more sophisticated version, we'd parse the actual requirement
  return { score: 1.0 };
}

function computeLocationScore(
  jobLocation: string | undefined,
  _candidate: CandidateProfile
): { score: number } {
  if (!jobLocation) {
    return { score: 1.0 };
  }

  const jobLoc = jobLocation.toLowerCase();

  // Remote jobs get full score (most flexible)
  if (jobLoc.includes('remote') || jobLoc.includes('work from home') || jobLoc.includes('wfh')) {
    return { score: 1.0 };
  }

  // If job location is specified and we don't have candidate location info, 
  // we give partial credit (flexibility)
  return { score: 0.7 };
}

// ============================================================================
// CONFIDENCE CALCULATION
// ============================================================================

function calculateOverallConfidence(
  jobExtraction: JobExtractionResult,
  candidate: CandidateProfile,
  skillsResult: { matchedSkills: MatchedSkill[]; totalWeight: number; matchedWeight: number },
  seniorityMatch: { score: number; isMatch: boolean },
  industryMatch: { isMatch: boolean; score: number }
): number {
  // Confidence is based on how well we can make determinations
  let confidence = 1.0;

  // Reduce confidence if extraction is uncertain
  if (jobExtraction.seniority_confidence < 0.8) {
    confidence *= 0.7;
  }

  // Reduce confidence if no skills matched but job had skills
  if (jobExtraction.skills.length > 0 && skillsResult.matchedWeight === 0) {
    confidence *= 0.6;
  }

  // Reduce confidence if seniority unclear
  if (!jobExtraction.seniority) {
    confidence *= 0.8;
  }

  // Reduce confidence if candidate info is sparse
  if (!candidate.years_experience_total) {
    confidence *= 0.8;
  }

  if (!candidate.primary_industry || candidate.primary_industry.length === 0) {
    confidence *= 0.8;
  }

  return Math.max(0, Math.min(1, confidence));
}

function calculateCandidateConfidence(candidate: CandidateProfile): number {
  let confidence = 0.5;

  if (candidate.candidate_skills && candidate.candidate_skills.length > 0) {
    confidence += 0.2;
  }

  if (candidate.years_experience_total !== null) {
    confidence += 0.15;
  }

  if (candidate.seniority_by_experience) {
    confidence += 0.15;
  }

  return Math.min(1, confidence);
}

// ============================================================================
// REASON GENERATION
// ============================================================================

function generateReasons(
  skillsResult: { matchedSkills: MatchedSkill[]; totalWeight: number; matchedWeight: number },
  seniorityMatch: { score: number; isMatch: boolean; isAdjacent: boolean },
  industryMatch: { isMatch: boolean; score: number },
  experienceMatch: { meetsRequirement: boolean; score: number },
  jobExtraction: JobExtractionResult
): string[] {
  const reasons: string[] = [];

  // Skills reasons
  if (skillsResult.matchedSkills.length > 0) {
    const requiredMatches = skillsResult.matchedSkills.filter(
      m => m.job_skill_importance === 'required'
    ).length;
    const totalRequired = jobExtraction.skills.filter(
      s => s.importance === 'required'
    ).length;

    if (requiredMatches > 0 && totalRequired > 0) {
      reasons.push(`${requiredMatches}/${totalRequired} required skills matched: ${skillsResult.matchedSkills.slice(0, 3).map(m => m.skill_name).join(', ')}`);
    } else if (skillsResult.matchedSkills.length > 0) {
      reasons.push(`${skillsResult.matchedSkills.length} skills matched: ${skillsResult.matchedSkills.slice(0, 3).map(m => m.skill_name).join(', ')}`);
    }
  } else if (jobExtraction.skills.length > 0) {
    reasons.push('No skills matched from job requirements');
  }

  // Seniority reasons
  if (seniorityMatch.isMatch) {
    reasons.push(`Seniority aligned: ${jobExtraction.seniority || 'level'}`);
  } else if (seniorityMatch.isAdjacent) {
    reasons.push(`Seniority close: adjacent level`);
  }

  // Industry reasons
  if (industryMatch.isMatch) {
    if (industryMatch.score === 1.0) {
      reasons.push(`Industry match: ${jobExtraction.industry?.[0] || 'field'}`);
    } else {
      reasons.push(`Related industry: ${jobExtraction.industry?.[0] || 'field'}`);
    }
  } else if (jobExtraction.industry && jobExtraction.industry.length > 0) {
    reasons.push(`Industry mismatch: ${jobExtraction.industry[0]}`);
  }

  // Experience reasons
  if (experienceMatch.meetsRequirement) {
    reasons.push('Meets experience requirements');
  }

  return reasons;
}

// ============================================================================
// EXPORT WEIGHTS FOR ADJUSTMENT
// ============================================================================

export function getScoreWeights() {
  return { ...SCORE_WEIGHTS };
}

export function setScoreWeights(customWeights: Partial<typeof SCORE_WEIGHTS>) {
  Object.assign(SCORE_WEIGHTS, customWeights);
}
