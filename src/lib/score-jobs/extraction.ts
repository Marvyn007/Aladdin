/**
 * Score Jobs Pipeline - LLM Extraction Service
 * 
 * Handles extraction of job description and candidate profile data using LLM
 * with strict constraints to avoid hallucinations.
 */

import { callLLM, safeJsonParse, type LLMMessage } from '../resume-generation/utils';
import type { 
  JobExtractionResult, 
  CandidateProfile, 
  ExtractedSkill,
  CandidateSkill 
} from '@/types';

// ============================================================================
// SYSTEM PROMPTS (STRICT)
// ============================================================================

const EXTRACTION_SYSTEM_PROMPT = `You are an information extractor. Your job: extract exact, verifiable data only from the provided text. 
DO NOT INVENT, GUESS, OR HALLUCINATE. If a fact is not explicitly present, return null / empty.

When asked to extract skills, seniority, or industry:
- Only return items that are present verbatim or clearly implied by the text.
- For each returned item, provide a confidence score between 0.0 and 1.0 (1.0 = exact).
- If confidence < 0.80, mark field as low_confidence and do NOT use it as final without fallback checks.

Output MUST be strict JSON (no commentary). Schema defined in the prompt.`;

// ============================================================================
// JOB EXTRACTION
// ============================================================================

const JOB_EXTRACTION_USER_PROMPT_TEMPLATE = `TEXT_TO_PARSE:
<<<
{jobDescriptionText}
>>>

TASK:
1) Extract job title (exact title string).
2) Extract industry or industries (e.g., "software engineering", "finance", "healthcare"). If not explicitly stated, return null.
3) Extract seniority level(s) demanded (choose from: internship, entry, junior, associate, mid, senior, staff, lead, manager, director, executive). If not present, return null.
4) List required skills and preferred skills as arrays. Mark primary skills (explicit "required" or in "must have") and secondary (explicit "nice to have").
5) For each skill include \`skill_name\` normalized (lowercase), \`original_phrase\`, and \`importance\` ("required" or "preferred") and \`confidence\` 0.0–1.0.
6) Provide a \`parsed_summary\` short sentence (1–2 lines) summarizing industry & seniority.
7) Return EXACT JSON only, using the schema below.

SCHEMA (exact JSON):
{
  "job_title": "string|null",
  "industry": ["string", ...] | null,
  "seniority": "string|null",
  "seniority_confidence": 0.0-1.0,
  "skills": [
    {
      "skill_name": "string",
      "original_phrase": "string",
      "importance": "required"|"preferred",
      "confidence": 0.0-1.0
    }, ...
  ],
  "parsed_summary": "string"
}`;

// ============================================================================
// CANDIDATE EXTRACTION
// ============================================================================

const CANDIDATE_EXTRACTION_USER_PROMPT_TEMPLATE = `TEXT_TO_PARSE:
<<<
{profileText}
>>>

TASK:
Extract candidate information from resume/LinkedIn profile text.

1) Extract candidate name (exact string)
2) Extract contact info: email, phone, linkedin URL
3) List candidate skills with proficiency/year if mentioned. For each skill include skill_name, confidence (0.0-1.0), years (number or null), and level (junior|intermediate|senior|null).
4) Extract primary industry (one or more)
5) Estimate seniority by experience - derive from explicit years-of-experience lines, job titles, and education. Return as one of: intern|entry|mid|senior|null with confidence.
6) Extract total years_experience_total if available.
7) Return EXACT JSON only, using the schema below.

SCHEMA (exact JSON):
{
  "candidate_name": "string|null",
  "contact": { "email": "string|null", "phone": "string|null", "linkedin":"string|null" },
  "candidate_skills": [ { "skill_name":"string", "confidence":0.0, "years": number|null, "level": "junior|intermediate|senior|null", "source": "resume"|"linkedin" }, ... ],
  "primary_industry": ["string", ...] | null,
  "seniority_by_experience": "intern|entry|mid|senior|null",
  "years_experience_total": number|null
}`;

// ============================================================================
// EXTRACTION FUNCTIONS
// ============================================================================

/**
 * Extract job information from job description text using LLM
 */
export async function extractJobInfo(jobDescriptionText: string): Promise<JobExtractionResult> {
  const userPrompt = JOB_EXTRACTION_USER_PROMPT_TEMPLATE.replace(
    '{jobDescriptionText}',
    jobDescriptionText
  );

  const messages: LLMMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await callLLM(messages, {
      temperature: 0.1,
      jsonMode: true,
      max_tokens: 4000
    });

    const parsed = safeJsonParse<JobExtractionResult>(response);

    if (!parsed) {
      console.warn('[ScoreJobs] Failed to parse job extraction response, using fallback');
      return createEmptyJobExtraction();
    }

    // Validate and sanitize the response
    return sanitizeJobExtraction(parsed);
  } catch (error) {
    console.error('[ScoreJobs] Job extraction error:', error);
    return createEmptyJobExtraction();
  }
}

/**
 * Extract candidate information from profile text using LLM
 */
export async function extractCandidateInfo(profileText: string): Promise<Partial<CandidateProfile>> {
  const userPrompt = CANDIDATE_EXTRACTION_USER_PROMPT_TEMPLATE.replace(
    '{profileText}',
    profileText
  );

  const messages: LLMMessage[] = [
    { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
    { role: 'user', content: userPrompt }
  ];

  try {
    const response = await callLLM(messages, {
      temperature: 0.1,
      jsonMode: true,
      max_tokens: 4000
    });

    const parsed = safeJsonParse<CandidateProfile>(response);

    if (!parsed) {
      console.warn('[ScoreJobs] Failed to parse candidate extraction response, using fallback');
      return createEmptyCandidateExtraction();
    }

    return sanitizeCandidateExtraction(parsed);
  } catch (error) {
    console.error('[ScoreJobs] Candidate extraction error:', error);
    return createEmptyCandidateExtraction();
  }
}

// ============================================================================
// SANITIZATION & FALLBACKS
// ============================================================================

function createEmptyJobExtraction(): JobExtractionResult {
  return {
    job_title: null,
    industry: null,
    seniority: null,
    seniority_confidence: 0,
    skills: [],
    parsed_summary: ''
  };
}

function createEmptyCandidateExtraction(): Partial<CandidateProfile> {
  return {
    candidate_name: null,
    contact: { email: null, phone: null, linkedin: null },
    candidate_skills: [],
    primary_industry: null,
    seniority_by_experience: null,
    years_experience_total: null
  };
}

function sanitizeJobExtraction(extraction: JobExtractionResult): JobExtractionResult {
  return {
    job_title: typeof extraction.job_title === 'string' ? extraction.job_title : null,
    industry: Array.isArray(extraction.industry) ? extraction.industry.filter(s => typeof s === 'string') : null,
    seniority: typeof extraction.seniority === 'string' ? extraction.seniority : null,
    seniority_confidence: typeof extraction.seniority_confidence === 'number' 
      ? Math.max(0, Math.min(1, extraction.seniority_confidence)) 
      : 0,
    skills: Array.isArray(extraction.skills) 
      ? extraction.skills.filter(s => s && s.skill_name).map(s => ({
          skill_name: String(s.skill_name).toLowerCase().trim(),
          original_phrase: s.original_phrase || s.skill_name,
          importance: s.importance === 'required' || s.importance === 'preferred' ? s.importance : 'preferred',
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0
        }))
      : [],
    parsed_summary: typeof extraction.parsed_summary === 'string' ? extraction.parsed_summary : ''
  };
}

function sanitizeCandidateExtraction(extraction: Partial<CandidateProfile>): Partial<CandidateProfile> {
  return {
    candidate_name: typeof extraction.candidate_name === 'string' ? extraction.candidate_name : null,
    contact: {
      email: typeof extraction.contact?.email === 'string' ? extraction.contact.email : null,
      phone: typeof extraction.contact?.phone === 'string' ? extraction.contact.phone : null,
      linkedin: typeof extraction.contact?.linkedin === 'string' ? extraction.contact.linkedin : null
    },
    candidate_skills: Array.isArray(extraction.candidate_skills)
      ? extraction.candidate_skills.filter(s => s && s.skill_name).map(s => ({
          skill_name: String(s.skill_name).toLowerCase().trim(),
          confidence: typeof s.confidence === 'number' ? Math.max(0, Math.min(1, s.confidence)) : 0,
          years: typeof s.years === 'number' ? s.years : null,
          level: s.level === 'junior' || s.level === 'intermediate' || s.level === 'senior' ? s.level : null,
          source: s.source === 'resume' || s.source === 'linkedin' ? s.source : 'resume'
        }))
      : [],
    primary_industry: Array.isArray(extraction.primary_industry) 
      ? extraction.primary_industry.filter(s => typeof s === 'string') 
      : null,
    seniority_by_experience: typeof extraction.seniority_by_experience === 'string' 
      ? extraction.seniority_by_experience 
      : null,
    years_experience_total: typeof extraction.years_experience_total === 'number' 
      ? extraction.years_experience_total 
      : null
  };
}

// ============================================================================
// CONFIDENCE HELPERS
// ============================================================================

/**
 * Calculate overall extraction confidence for job
 */
export function calculateJobExtractionConfidence(extraction: JobExtractionResult): number {
  const skillConfidences = extraction.skills.map(s => s.confidence);
  const avgSkillConfidence = skillConfidences.length > 0
    ? skillConfidences.reduce((a, b) => a + b, 0) / skillConfidences.length
    : 0.5;

  // Weight seniority more heavily
  return (extraction.seniority_confidence * 0.4) + (avgSkillConfidence * 0.6);
}

/**
 * Calculate overall extraction confidence for candidate
 */
export function calculateCandidateExtractionConfidence(candidate: Partial<CandidateProfile>): number {
  const skillConfidences = candidate.candidate_skills?.map(s => s.confidence) || [];
  const avgSkillConfidence = skillConfidences.length > 0
    ? skillConfidences.reduce((a, b) => a + b, 0) / skillConfidences.length
    : 0.5;

  const hasExperience = candidate.years_experience_total != null ? 1 : 0;
  const hasSeniority = candidate.seniority_by_experience != null ? 1 : 0;

  return (avgSkillConfidence * 0.6) + (hasExperience * 0.2) + (hasSeniority * 0.2);
}
