// TypeScript types for job-hunt-vibe application

// Job-related types
export type JobStatus = 'fresh' | 'archived' | 'saved';

export interface Job {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  source_url: string;
  posted_at: string | null;
  fetched_at: string;
  status: JobStatus;
  match_score: number;
  matched_skills: string[] | null;
  missing_skills: string[] | null;
  why: string | null;
  normalized_text: string | null;
  raw_text_summary: string | null;
  content_hash: string | null;
  isImported?: boolean;
  original_posted_date?: string | null;
  original_posted_raw?: string | null;
  original_posted_source?: string | null;
  location_display?: string | null;
  company_logo_url?: string | null;
  logo_cached_at?: string | null;
  import_tag?: string | null;
  raw_description_html?: string | null;
  job_description_plain?: string | null;
  date_posted_iso?: string | null;
  date_posted_display?: string | null;
  date_posted_relative?: boolean;
  source_host?: string | null;
  scraped_at?: string | null;
  extraction_confidence?: { description: number; date: number; location: number } | null;
  latitude?: number | null;
  longitude?: number | null;
  geo_resolved?: boolean;
  geo_confidence?: number | null;
  geo_source?: string | null;
  location_raw?: string | null;
  edited_by_user?: boolean;
  updated_at?: string | null;
  posted_by_user_id?: string | null; // actual DB column (snake_case)
  postedByUserId?: string | null;    // camelCase alias (mapped in some contexts)
  postedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    votes: number;
  } | null;
}

export interface JobWithPostedBy extends Job {
  postedBy?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    imageUrl: string | null;
    votes: number;
  } | null;
}

export interface JobWithApplication extends Job {
  application?: Application | null;
}

// Resume types
export interface Resume {
  id: string;
  filename: string;
  upload_at: string;
  parsed_json: ParsedResume | null;
  is_default: boolean;
  s3_key?: string | null;
}

export interface ParsedResume {
  name: string | null;
  email: string | null;
  location: string | null;
  total_experience_years: number | null;
  roles: ResumeRole[];
  education: ResumeEducation[];
  skills: ResumeSkill[];
  projects: ResumeProject[];
  certifications: string[];
  open_to: string[];
  // Enhanced fields for scoring
  tools?: string[];
  languages?: string[];
  frameworks?: string[];
  contact?: {
    email?: string;
    phone?: string;
    location?: string;
    linkedin?: string;
  };
}

export interface ResumeRole {
  title: string;
  company: string;
  start: string | null;
  end: string | null;
  description: string;
}

export interface ResumeEducation {
  degree: string;
  school: string;
  start: string;
  end: string;
  notes: string;
}

export interface ResumeSkill {
  name: string;
  level: 'expert' | 'advanced' | 'intermediate' | 'beginner';
  years: number | null;
}

export interface ResumeProject {
  title: string;
  description: string;
  tech: string[];
  link: string;
}

// LinkedIn profile types
export interface LinkedInProfile {
  id: string;
  filename: string;
  upload_at: string;
  parsed_json: ParsedResume | null; // Uses same structure as resume
  s3_key?: string | null;
}

// Application tracker types
export type ApplicationColumn =
  | 'Applied'
  | 'Got OA'
  | 'Interview R1'
  | 'Interview R2'
  | 'Interview R3'
  | 'Interview R4'
  | 'Got Offer';

export interface Application {
  id: string;
  job_id: string;
  column_name: ApplicationColumn;
  applied_at: string;
  notes: string | null;
  resume_id: string | null;
  cover_letter_id: string | null;
  external_link: string | null;
  deleted: boolean;
}

export interface ApplicationWithJob extends Application {
  job: Job;
}

// Cover letter types
export interface CoverLetter {
  id: string;
  job_id: string;
  resume_id: string | null;
  generated_at: string;
  content_html: string | null;
  content_text: string | null;
  pdf_blob_url: string | null;
  s3_key?: string | null;
  status: 'pending' | 'generated' | 'failed';
}

// Gemini API response types
export interface ScoreBreakdown {
  skills: number;      // 0-40
  experience: number;  // 0-25
  role_fit: number;    // 0-20
  context: number;     // 0-15
}

export interface ScoreResult {
  job_id: string;
  match_score: number;
  score_breakdown?: ScoreBreakdown;
  matched_skills: string[];
  missing_important_skills: string[];
  level_match: 'exact' | 'close' | 'no';
  why: string;
}

export interface CoverLetterResult {
  cover_letter: string;
  highlights?: string[];
}

export interface TailoredResumeResult {
  resume_html: string;
  added_keywords: string[];
  confidence_score: number;
}

// API request/response types
export interface UploadResumeRequest {
  file: File;
  setAsDefault?: boolean;
}

export interface FindFreshRequest {
  limit?: number;
}

export interface BookmarkRequest {
  title: string;
  url: string;
  selectedText: string;
}

export interface GenerateCoverLetterRequest {
  job_id: string;
  resume_id?: string;
}

// UI state types
export interface FilterState {
  location: string;
  remoteOnly: boolean;
  techTags: string[];
}

export interface AppSettings {
  freshLimit: number;
  lastUpdated: string | null;
  excludedKeywords: string[];
}

// Bookmarklet payload
export interface BookmarkletPayload {
  title: string;
  url: string;
  selectedText: string;
  timestamp: string;
}

// ============================================================================
// TAILORED RESUME TYPES
// ============================================================================

export interface ResumeContactInfo {
  name: string;
  email: string;
  phone: string;
  location?: string;
  linkedin: string;
  github: string[];
  website?: string;
}

export interface ResumeBullet {
  id: string;
  text: string;
  isSuggested?: boolean; // "Suggested (add if true)" for unverified skills
}

export interface ResumeSectionItem {
  id: string;
  title: string;
  subtitle?: string;
  location?: string;
  dates?: string;
  technologies?: string;
  bullets: ResumeBullet[];
  links?: { label: string; url: string }[];
}

export interface ResumeSection {
  id: string;
  type: 'education' | 'experience' | 'projects' | 'community' | 'skills' | 'volunteer' | 'certifications';
  title: string;
  isCollapsed?: boolean;
  items: ResumeSectionItem[];
}

export type ResumeSkillsSection = Record<string, string[]>;

export interface ResumeDesign {
  template: 'classic' | 'modern';
  fontFamily: string;
  fontSize: number;
  accentColor: string;
  margins: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

export interface TailoredResumeData {
  id: string;
  contact: ResumeContactInfo;
  summary?: string;
  sections: ResumeSection[];
  skills: ResumeSkillsSection;
  design: ResumeDesign;
  createdAt: string;
  updatedAt: string;
  jobId?: string;
  jobTitle?: string;
  hiddenContext?: ResumeSection[];  // Suppressed sections for UI toggling
}

export interface KeywordAnalysis {
  matched: string[];
  missing: string[];
  matchedCritical?: string[];
  missingCritical?: string[];
  atsScore?: {
    raw: number;
    weighted: number;
    matchedCount: number;
    totalCount: number;
  };
}

export interface TailoredResumeGenerationResponse {
  success: boolean;
  resume?: TailoredResumeData;
  keywords?: KeywordAnalysis;
  error?: string;
}

export interface ResumeDraft {
  id: string;
  userId: string;
  resumeData: TailoredResumeData;
  jobId?: string;
  createdAt: string;
  updatedAt: string;
}

// Leak check result — used to validate that generated resume contains
// ONLY data originating from the user's resume, LinkedIn, or job description.
export interface LeakCheckResult {
  passed: boolean;
  leaked_fields: string[];
  details?: string;
}

export const DEFAULT_RESUME_DESIGN: ResumeDesign = {
  template: 'classic',
  fontFamily: 'Times New Roman',
  fontSize: 12,
  accentColor: '#1a365d',
  margins: { top: 0.5, right: 0.5, bottom: 0.5, left: 0.5 },
};

// ============================================================================
// CANONICAL RESUME PARSER TYPES (with confidence scoring)
// ============================================================================

/** Generic wrapper that pairs a value with a confidence score (0–1). */
export interface ConfidenceField<T> {
  value: T;
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalContactLink {
  label: string; // e.g. "linkedin", "github", "portfolio"
  url: string;
  confidence: number;
}

export interface CanonicalContacts {
  email: ConfidenceField<string | null>;
  phone: ConfidenceField<string | null>;
  location: ConfidenceField<string | null>;
  links: CanonicalContactLink[];
}

export interface CanonicalEducation {
  institution: string;
  degree: string;
  start_date: string | null; // YYYY-MM
  end_date: string | null;   // YYYY-MM or "present"
  gpa: string | null;
  coursework: string | null;
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalExperience {
  company: string;
  title: string;
  start_date: string | null;
  end_date: string | null;
  location: string | null;
  description: string;
  skills: string[];
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalProject {
  name: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  skills: string[];
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalVolunteer {
  organization: string;
  title?: string;
  start_date: string | null;
  end_date: string | null;
  description: string;
  skills: string[];
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalSkills {
  explicit_list: string[];
  inferred_from_text: string[];
  confidence: number;
}

export interface CanonicalCertification {
  name: string;
  issuer: string | null;
  date: string | null;
  confidence: number;
  source?: 'resume' | 'linkedin';
}

export interface CanonicalParsedResume {
  name: ConfidenceField<string | null>;
  contacts: CanonicalContacts;
  summary: ConfidenceField<string | null>;
  education: CanonicalEducation[];
  experience: CanonicalExperience[];
  projects: CanonicalProject[];
  volunteer: CanonicalVolunteer[];
  skills: CanonicalSkills;
  certifications: CanonicalCertification[];
  low_confidence_fields?: string[];
  raw_text_snippets?: Record<string, string>;
}

/** A single section in the generated structured resume output. */
export interface GeneratedResumeSection {
  id: string;
  title: string;
  toggle_visible: boolean;
  items: GeneratedResumeSectionItem[];
}

export interface GeneratedResumeSectionItem {
  heading: string;
  subheading?: string;
  dates?: string;
  location?: string;
  bullets: string[];
  skills?: string[];
}

export interface GeneratedResumeStructured {
  summary: string;
  sections: GeneratedResumeSection[];
  skills_grouped: Record<string, string[]>;
}

export type ResumeParserStatus =
  | 'OK'
  | 'MISSING_RESUME'
  | 'PARSE_FAILED'
  | 'TOO_SHORT'
  | 'USER_MISMATCH'
  | 'RESUME_NOT_FOUND';

export interface ResumeParserResponse {
  status: ResumeParserStatus;
  message?: string;
  parsed_resume_json?: CanonicalParsedResume;
  generated_resume_markdown?: string;
  generated_resume_structured?: GeneratedResumeStructured;
  section_order?: string[];
  low_confidence_fields?: string[];
  leak_check_passed?: boolean;
  audit_event_id?: string;
}
