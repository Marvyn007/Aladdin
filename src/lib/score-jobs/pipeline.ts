/**
 * Score Jobs Pipeline - Main Orchestrator
 * 
 * Coordinates the complete scoring pipeline:
 * 1. Parse resume & LinkedIn PDFs
 * 2. Extract candidate profile
 * 3. Get jobs in date range (newest to 2 months old)
 * 4. For each job: extract info, compute score, save
 */

import type { Job, Resume, LinkedInProfile, CandidateProfile, ScoreResultV2 } from '@/types';
import { getResumes, getDefaultResume, getJobs, updateJobScore, getJobById, getDbType } from '../db';
import { extractJobInfo, extractCandidateInfo, calculateJobExtractionConfidence, calculateCandidateExtractionConfidence } from './extraction';
import { computeJobScore } from './scoring-formula';
import { normalizeIndustry, getCanonicalSkills } from './skill-normalization';

// Import DB helpers directly
import { getPostgresPool } from '@/lib/postgres';
import { getSupabaseClient } from '@/lib/supabase';
import { getSQLiteDB } from '@/lib/sqlite';

// ============================================================================
// PIPELINE CONFIG
// ============================================================================

const PIPELINE_CONFIG = {
  // Jobs from last 2 months from newest
  maxJobAgeMonths: 2,
  // Skip jobs already scored within this time window
  rescoreAfterDays: 7,
  // Batch size for LLM extraction
  batchSize: 5,
};

// ============================================================================
// MAIN PIPELINE FUNCTION
// ============================================================================

/**
 * Run the complete Score Jobs pipeline for a user
 */
export async function runScoreJobsPipeline(
  userId: string,
  options: {
    forceRescore?: boolean;
    jobIds?: string[];
    onProgress?: (progress: { current: number; total: number; jobTitle: string }) => void;
  } = {}
): Promise<{
  scored: { job_id: string; score: number; confidence: number }[];
  skipped: { job_id: string; reason: string }[];
  errors: string[];
  summary: {
    totalJobs: number;
    highConfidence: number;
    lowConfidence: number;
    avgScore: number;
  };
  message?: string;
}> {
  const { forceRescore = false, jobIds, onProgress } = options;
  
  const errors: string[] = [];
  const skipped: { job_id: string; reason: string }[] = [];
  const scored: { job_id: string; score: number; confidence: number }[] = [];

  try {
    // Step 1: Get and merge candidate profile from resume + LinkedIn
    const candidate = await buildCandidateProfile(userId);
    if (!candidate) {
      return { scored: [], skipped: [], errors: ['No resume found for user'], summary: { totalJobs: 0, highConfidence: 0, lowConfidence: 0, avgScore: 0 }, message: 'No resume found' };
    }

    // Step 2: Get jobs in date range (newest to 2 months older)
    const jobsResult = await getJobsInDateRange(userId, {
      jobIds,
      forceRescore,
    });

    console.log(`[ScoreJobs] newest_posted_at: ${jobsResult.newestPostedAt}`);
    console.log(`[ScoreJobs] oldest_allowed: ${jobsResult.oldestAllowed}`);
    console.log(`[ScoreJobs] jobs_selected_count: ${jobsResult.jobs.length}`);

    if (jobsResult.jobs.length === 0) {
      console.log('[ScoreJobs] No jobs in date range');
      return { 
        scored: [], 
        skipped: [], 
        errors: [], 
        summary: { totalJobs: 0, highConfidence: 0, lowConfidence: 0, avgScore: 0 },
        message: 'No jobs in date range (newest to 2 months old)'
      };
    }

    console.log(`[ScoreJobs] jobs_after_existing_score_filter: ${jobsResult.jobs.length}`);

    // Step 3: Score each job
    for (let i = 0; i < jobsResult.jobs.length; i++) {
      const job = jobsResult.jobs[i];
      
      if (onProgress) {
        onProgress({ current: i + 1, total: jobsResult.jobs.length, jobTitle: job.title });
      }

      try {
        // Get full job details including description
        const fullJob = await getJobById(userId, job.id);
        if (!fullJob) {
          errors.push(`Job not found: ${job.id}`);
          continue;
        }

        // Skip jobs without descriptions
        const jobDescription = fullJob.normalized_text || fullJob.job_description_plain || '';
        
        if (!jobDescription || jobDescription.length < 50) {
          console.log(`[ScoreJobs] Skipping job ${job.id} - no description`);
          skipped.push({ job_id: job.id, reason: 'no job description' });
          continue;
        }

        // Extract job info using LLM
        const jobExtraction = await extractJobInfo(jobDescription);

        // Compute score
        const scoreResult = await computeJobScore(
          job.id,
          jobDescription,
          jobExtraction,
          candidate,
          fullJob.location || undefined
        );

        // Save to database (use existing updateJobScore for compatibility)
        const matchedSkillsStrings = scoreResult.matched_skills.map(ms => ms.skill_name);
        const missingSkillsStrings = jobExtraction.skills
          .filter(js => !scoreResult.matched_skills.some(ms => ms.skill_name === js.skill_name))
          .map(js => js.skill_name);
        
        const why = scoreResult.reasons.join('; ');

        await updateJobScore(
          userId,
          job.id,
          scoreResult.score,
          matchedSkillsStrings,
          missingSkillsStrings,
          why
        );

        // Persist to job_scores table
        await persistJobScore(userId, job.id, scoreResult);

        scored.push({
          job_id: job.id,
          score: scoreResult.score,
          confidence: scoreResult.confidence,
        });

      } catch (err) {
        const errorMsg = `Error scoring job ${job.id}: ${err instanceof Error ? err.message : 'Unknown error'}`;
        console.error('[ScoreJobs]', errorMsg);
        errors.push(errorMsg);
      }
    }

    console.log(`[ScoreJobs] scored: ${scored.length}`);

    // Generate summary
    const highConfidence = scored.filter(s => s.confidence >= 0.8).length;
    const lowConfidence = scored.filter(s => s.confidence < 0.8).length;
    const avgScore = scored.length > 0
      ? scored.reduce((sum, s) => sum + s.score, 0) / scored.length
      : 0;

    return {
      scored,
      skipped,
      errors,
      summary: {
        totalJobs: jobsResult.jobs.length,
        highConfidence,
        lowConfidence,
        avgScore: Math.round(avgScore),
      },
      message: `Scored ${scored.length} jobs`,
    };
  } catch (err) {
    console.error('[ScoreJobs] Pipeline error:', err);
    return {
      scored,
      skipped,
      errors: [...errors, err instanceof Error ? err.message : 'Pipeline failed'],
      summary: { totalJobs: scored.length, highConfidence: 0, lowConfidence: 0, avgScore: 0 },
    };
  }
}

// ============================================================================
// JOB SELECTION WITH DATE RANGE
// ============================================================================

interface JobsInDateRangeResult {
  jobs: Job[];
  newestPostedAt: string | null;
  oldestAllowed: string | null;
}

/**
 * Get jobs in date range: newest_posted_at down to newest - 2 months
 */
async function getJobsInDateRange(
  userId: string,
  options: {
    jobIds?: string[];
    forceRescore?: boolean;
  }
): Promise<JobsInDateRangeResult> {
  const { jobIds, forceRescore = false } = options;

  // Get all fresh jobs to find newest_posted_at
  const allJobs = await getJobs(userId, 'fresh', 1, 500);
  
  if (allJobs.length === 0) {
    return { jobs: [], newestPostedAt: null, oldestAllowed: null };
  }

  // Find newest_posted_at from fresh jobs
  let newestPostedAt: Date | null = null;
  for (const job of allJobs) {
    if (job.posted_at) {
      const postedAt = new Date(job.posted_at);
      if (!newestPostedAt || postedAt > newestPostedAt) {
        newestPostedAt = postedAt;
      }
    }
  }

  if (!newestPostedAt) {
    // If no posted_at, use all jobs
    const filtered = await filterByExistingScores(allJobs, userId, forceRescore);
    return { jobs: filtered, newestPostedAt: null, oldestAllowed: null };
  }

  // Compute oldest_allowed = newest - 2 months
  const oldestAllowed = new Date(newestPostedAt);
  oldestAllowed.setMonth(oldestAllowed.getMonth() - PIPELINE_CONFIG.maxJobAgeMonths);

  console.log(`[ScoreJobs] Date range: ${oldestAllowed.toISOString()} to ${newestPostedAt.toISOString()}`);

  // Filter jobs to date range
  let jobsInRange = allJobs.filter(job => {
    if (!job.posted_at) return false; // Skip jobs without posted_at
    const postedAt = new Date(job.posted_at);
    return postedAt >= oldestAllowed && postedAt <= newestPostedAt;
  });

  console.log(`[ScoreJobs] Jobs in range: ${jobsInRange.length}`);

  // If specific jobIds provided, filter to those
  if (jobIds && jobIds.length > 0) {
    jobsInRange = jobsInRange.filter(job => jobIds.includes(job.id));
  }

  // Filter by existing scores
  jobsInRange = await filterByExistingScores(jobsInRange, userId, forceRescore);

  return {
    jobs: jobsInRange,
    newestPostedAt: newestPostedAt.toISOString(),
    oldestAllowed: oldestAllowed.toISOString(),
  };
}

/**
 * Filter out jobs that already have scores (unless forceRescore)
 */
async function filterByExistingScores(
  jobs: Job[],
  userId: string,
  forceRescore: boolean
): Promise<Job[]> {
  if (forceRescore) {
    return jobs;
  }

  // Get existing scores for user
  const existingScores = await getExistingJobScores(userId);
  const scoredJobIds = new Set(existingScores.map(s => s.job_id));

  // Filter out already scored jobs
  return jobs.filter(job => !scoredJobIds.has(job.id));
}

// ============================================================================
// JOB SCORES PERSISTENCE
// ============================================================================

interface JobScoreRow {
  job_id: string;
  score: number;
  confidence: number;
}

/**
 * Get existing job scores for a user
 */
async function getExistingJobScores(userId: string): Promise<JobScoreRow[]> {
  const dbType = getDbType();

  try {
    if (dbType === 'postgres') {
      const pool = getPostgresPool();
      const result = await pool.query(
        'SELECT job_id, score, confidence FROM job_scores WHERE user_id = $1',
        [userId]
      );
      return result.rows;
    } else if (dbType === 'supabase') {
      const client = getSupabaseClient();
      const { data, error } = await client
        .from('job_scores')
        .select('job_id, score, confidence')
        .eq('user_id', userId);
      
      if (error) return [];
      return data || [];
    } else {
      // SQLite
      const db = getSQLiteDB();
      const rows = db.prepare('SELECT job_id, score, confidence FROM job_scores WHERE user_id = ?').all(userId) as JobScoreRow[];
      return rows || [];
    }
  } catch (error) {
    console.log('[ScoreJobs] Error getting existing scores (table may not exist):', error);
    return [];
  }
}

/**
 * Persist job score to job_scores table
 */
async function persistJobScore(
  userId: string,
  jobId: string,
  scoreResult: ScoreResultV2
): Promise<void> {
  const dbType = getDbType();

  try {
    if (dbType === 'postgres') {
      const pool = getPostgresPool();
      await pool.query(`
        INSERT INTO job_scores (user_id, job_id, score, confidence, breakdown, extracted_meta, scored_at)
        VALUES ($1, $2, $3, $4, $5, $6, NOW())
        ON CONFLICT (user_id, job_id) DO UPDATE SET
          score = EXCLUDED.score,
          confidence = EXCLUDED.confidence,
          breakdown = EXCLUDED.breakdown,
          extracted_meta = EXCLUDED.extracted_meta,
          scored_at = NOW()
      `, [
        userId,
        jobId,
        scoreResult.score,
        scoreResult.confidence,
        JSON.stringify(scoreResult.breakdown),
        JSON.stringify(scoreResult.extraction_meta),
      ]);
    } else if (dbType === 'supabase') {
      const client = getSupabaseClient();
      await client.from('job_scores').upsert({
        user_id: userId,
        job_id: jobId,
        score: scoreResult.score,
        confidence: scoreResult.confidence,
        breakdown: scoreResult.breakdown,
        extracted_meta: scoreResult.extraction_meta,
        scored_at: new Date().toISOString(),
      }, { onConflict: 'user_id,job_id' });
    } else {
      // SQLite
      const db = getSQLiteDB();
      db.prepare(`
        INSERT OR REPLACE INTO job_scores (user_id, job_id, score, confidence, breakdown, extracted_meta, scored_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `).run(
        userId,
        jobId,
        scoreResult.score,
        scoreResult.confidence,
        JSON.stringify(scoreResult.breakdown),
        JSON.stringify(scoreResult.extraction_meta)
      );
    }
  } catch (error) {
    console.log('[ScoreJobs] Error persisting score:', error);
    // Don't fail the whole pipeline if persistence fails
  }
}

// ============================================================================
// CANDIDATE PROFILE BUILDER
// ============================================================================

/**
 * Build merged candidate profile from resume + LinkedIn
 */
async function buildCandidateProfile(userId: string): Promise<CandidateProfile | null> {
  const resumes = await getResumes(userId);
  
  if (resumes.length === 0) {
    console.log('[ScoreJobs] No resumes found for user');
    return null;
  }
  
  const defaultResume = resumes.find(r => r.is_default) || resumes[0];
  
  if (!defaultResume?.parsed_json) {
    console.log('[ScoreJobs] Resume found but not parsed');
    return null;
  }

  const resume = defaultResume.parsed_json;
  const sourceFlags = {
    has_resume: !!resume,
    has_linkedin: false,
  };

  const candidateSkills = extractSkillsFromResume(resume);

  return {
    candidate_name: resume.name,
    contact: {
      email: resume.contact?.email || null,
      phone: resume.contact?.phone || null,
      linkedin: resume.contact?.linkedin || null,
    },
    candidate_skills: candidateSkills,
    primary_industry: null,
    seniority_by_experience: estimateSeniorityFromResume(resume),
    years_experience_total: resume.total_experience_years,
    source_flags: sourceFlags,
  };
}

function extractSkillsFromResume(resume: any): CandidateProfile['candidate_skills'] {
  const skills: CandidateProfile['candidate_skills'] = [];

  if (resume.skills && Array.isArray(resume.skills)) {
    for (const skill of resume.skills) {
      const skillName = typeof skill === 'string' ? skill : skill.name;
      if (skillName) {
        skills.push({
          skill_name: skillName.toLowerCase().trim(),
          confidence: 0.9,
          years: skill.years || null,
          level: skill.level || null,
          source: 'resume',
        });
      }
    }
  }

  if (resume.tools && Array.isArray(resume.tools)) {
    for (const tool of resume.tools) {
      const toolName = typeof tool === 'string' ? tool : tool.name;
      if (toolName && !skills.some(s => s.skill_name === toolName.toLowerCase())) {
        skills.push({
          skill_name: toolName.toLowerCase().trim(),
          confidence: 0.8,
          years: null,
          level: null,
          source: 'resume',
        });
      }
    }
  }

  if (resume.frameworks && Array.isArray(resume.frameworks)) {
    for (const fw of resume.frameworks) {
      const fwName = typeof fw === 'string' ? fw : fw.name;
      if (fwName && !skills.some(s => s.skill_name === fwName.toLowerCase())) {
        skills.push({
          skill_name: fwName.toLowerCase().trim(),
          confidence: 0.8,
          years: null,
          level: null,
          source: 'resume',
        });
      }
    }
  }

  return skills;
}

function estimateSeniorityFromResume(resume: any): string | null {
  const years = resume.total_experience_years;
  
  if (years === null || years === undefined) {
    if (resume.roles && resume.roles.length > 0) {
      return 'mid';
    }
    return null;
  }

  if (years <= 1) return 'intern';
  if (years <= 3) return 'junior';
  if (years <= 6) return 'mid';
  if (years <= 10) return 'senior';
  return 'staff';
}

// ============================================================================
// EXPORT CONFIG
// ============================================================================

export function getPipelineConfig() {
  return { ...PIPELINE_CONFIG };
}

export function setPipelineConfig(config: Partial<typeof PIPELINE_CONFIG>) {
  Object.assign(PIPELINE_CONFIG, config);
}
