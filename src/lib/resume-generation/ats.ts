/**
 * ats.ts
 * ATS keyword extraction and scoring.
 * Extracts keywords from job descriptions, computes coverage, and identifies gaps.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { ATSKeywords, ATSResult } from "./types";
import { callLLM, safeJsonParse } from "./utils";

// ---------------------------------------------------------------------------
// Extract ATS Keywords from Job Description
// ---------------------------------------------------------------------------

const EXTRACT_PROMPT = `You are an ATS (Applicant Tracking System) keyword extractor.
Given a job description, extract:
1. requiredSkills — hard technical skills, programming languages, frameworks
2. tools — specific tools, platforms, services (AWS, Docker, Git, etc.)
3. frameworks — libraries and frameworks (React, TensorFlow, etc.)
4. domainKeywords — domain-specific terms, soft skills, methodologies (Agile, CI/CD, etc.)

OUTPUT VALID JSON ONLY — no markdown fences, no explanation.
{
  "requiredSkills": [...],
  "tools": [...],
  "frameworks": [...],
  "domainKeywords": [...]
}
Deduplicate entries. Be thorough — extract every relevant keyword.`;

/**
 * Extracts ATS keywords from a job description using LLM.
 */
export async function extractATSKeywords(
  jobDescription: string
): Promise<ATSKeywords> {
  const response = await callLLM(
    [
      { role: "system", content: EXTRACT_PROMPT },
      {
        role: "user",
        content: `Extract ATS keywords from this job description:\n\n${jobDescription.slice(0, 5000)}`,
      },
    ],
    { temperature: 0, max_tokens: 2000 }
  );

  const parsed = safeJsonParse<ATSKeywords>(response);
  if (!parsed) {
    console.warn("[ats] LLM extraction failed, using empty keywords");
    return { requiredSkills: [], tools: [], frameworks: [], domainKeywords: [] };
  }

  return {
    requiredSkills: Array.isArray(parsed.requiredSkills)
      ? parsed.requiredSkills
      : [],
    tools: Array.isArray(parsed.tools) ? parsed.tools : [],
    frameworks: Array.isArray(parsed.frameworks) ? parsed.frameworks : [],
    domainKeywords: Array.isArray(parsed.domainKeywords)
      ? parsed.domainKeywords
      : [],
  };
}

// ---------------------------------------------------------------------------
// Flatten Keywords
// ---------------------------------------------------------------------------

/**
 * Flattens all ATS keyword categories into a single deduplicated array.
 */
export function flattenATSKeywords(ats: ATSKeywords): string[] {
  const all = [
    ...ats.requiredSkills,
    ...ats.tools,
    ...ats.frameworks,
    ...ats.domainKeywords,
  ];
  return [...new Set(all.map((k) => k.toLowerCase()))].map(
    (k) => all.find((original) => original.toLowerCase() === k) || k
  );
}

// ---------------------------------------------------------------------------
// Missing Skills Computation
// ---------------------------------------------------------------------------

/**
 * Computes which JD keywords are NOT present in the resume's skill list.
 */
export function computeMissingSkills(
  resumeSkills: string[],
  atsKeywords: ATSKeywords
): string[] {
  const resumeSkillsLower = new Set(
    resumeSkills.map((s) => s.toLowerCase().trim())
  );

  const allJdKeywords = flattenATSKeywords(atsKeywords);

  const missing = allJdKeywords.filter(
    (kw) => !resumeSkillsLower.has(kw.toLowerCase().trim())
  );

  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const m of missing) {
    const key = m.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(m);
    }
  }

  return deduped;
}

// ---------------------------------------------------------------------------
// ATS Score Computation
// ---------------------------------------------------------------------------

export interface ATSContext {
  skills: string[];
  experience: any[]; // Kept for signature compatibility
  bulletText: string;
}

/**
 * Computes ATS keyword coverage by extracting keywords from the JD
 * and comparing them against the Master Profile text.
 */
export async function computeATSScore(
  context: ATSContext,
  jobDescription: string
): Promise<ATSResult> {
  const atsKeywords = await extractATSKeywords(jobDescription);
  const allJdKeywords = flattenATSKeywords(atsKeywords);

  if (allJdKeywords.length === 0) {
    return { keyword_coverage: 100, matched_keywords: [], missing_keywords: [] };
  }

  // Combine resume skills and full bullet text for matching
  const resumeTextLower = [
    ...context.skills.map((s) => s.toLowerCase()),
    context.bulletText.toLowerCase(),
  ].join(" ");

  const matched: string[] = [];
  const missing: string[] = [];

  for (const kw of allJdKeywords) {
    if (resumeTextLower.includes(kw.toLowerCase())) {
      matched.push(kw);
    } else {
      missing.push(kw);
    }
  }

  const keyword_coverage = Math.round(
    (matched.length / allJdKeywords.length) * 100
  );

  console.log(
    `[ats] ATS Score: ${keyword_coverage}% (${matched.length}/${allJdKeywords.length} keywords matched)`
  );

  return {
    keyword_coverage,
    matched_keywords: [...new Set(matched)],
    missing_keywords: [...new Set(missing)],
  };
}
