/**
 * types.ts
 * All shared TypeScript interfaces for the Master Profile resume generation pipeline.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ---------------------------------------------------------------------------
// Input / File Types
// ---------------------------------------------------------------------------

export type FileInput = File | Buffer | string | { buffer: Buffer; name?: string };

export interface GenerateTailoredResumeParams {
  /** PDF of the user's default/base resume (required) */
  resumePdf: FileInput;
  /** PDF of the user's LinkedIn export (optional) */
  linkedinPdf?: FileInput;
  /** Raw text payload from the user's LinkedIn profile (optional) */
  linkedinData?: string;
  /** Raw job description text (required) */
  jobDescription: string;
  /** Optional callback to stream SSE progress updates back to the client natively */
  onProgress?: (event: string, data: any) => void;
}

// ---------------------------------------------------------------------------
// Dynamic Parsed Resume Structure
// ---------------------------------------------------------------------------

export interface ResumeBasics {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  headline: string;
}

/**
 * A generalized entry within any resume section.
 * E.g., a Job, a Project, a Volunteer role, an Education degree.
 */
export interface DynamicEntry {
  title: string;
  subtitle: string;     // e.g. Company, Institution
  location: string;
  startDate: string;
  endDate: string;
  bullets: string[];
}

/**
 * A section of the resume (e.g., "Experience", "Publications", "Leadership")
 */
export interface DynamicSection {
  name: string;
  entries: DynamicEntry[];
}

export interface DynamicParsedResume {
  basics: ResumeBasics;
  summary: string;
  sections: DynamicSection[];
  skills: string[];
}

/** Result from parser — includes both raw text and structured data */
export interface ParseResult {
  rawText: string;
  structured: DynamicParsedResume;
}

// ---------------------------------------------------------------------------
// Master Profile & Temp Resume Types
// ---------------------------------------------------------------------------

/**
 * An entry after merging Resume and LinkedIn
 */
export interface MasterProfileEntry extends DynamicEntry {
  source_resume: boolean;
  source_linkedin: boolean;
  merged_description?: string; // If applicable, paragraph form
}

export interface MasterProfileSection {
  name: string;
  entries: MasterProfileEntry[];
}

export interface MasterProfile {
  basics: ResumeBasics;
  summary: string;
  sections: MasterProfileSection[];
  skills: Record<string, string[]>;
}

// ---------------------------------------------------------------------------
// ATS Types
// ---------------------------------------------------------------------------

export interface ATSKeywords {
  requiredSkills: string[];
  tools: string[];
  frameworks: string[];
  domainKeywords: string[];
}

export interface ATSResult {
  keyword_coverage: number;
  matched_keywords: string[];
  missing_keywords: string[];
}

// ---------------------------------------------------------------------------
// Final Output — Flattened (backward-compatible for SSE + frontend)
// ---------------------------------------------------------------------------

export interface TailoredResumeOutput {
  basics: ResumeBasics;
  summary: string;
  sections: DynamicSection[];
  skills: Record<string, string[]>;
  missingSkills: string[];
  autoAddedSkills?: string[];
  /** ATS scoring data */
  ats?: ATSResult;
}
