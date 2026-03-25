import { describe, it, expect } from 'vitest';
import { computePreferenceScore } from '@/lib/preference-scoring';
import type { Job } from '@/types';
import type { OnboardingAnswerRecord } from '@/lib/onboarding';

// Helper to build a minimal Job object
function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'test-job',
    title: 'Software Engineer',
    company: 'Test Corp',
    location: 'San Francisco, CA',
    source_url: 'https://example.com',
    posted_at: null,
    fetched_at: new Date().toISOString(),
    status: 'fresh',
    normalized_text: null,
    raw_text_summary: null,
    content_hash: null,
    ...overrides,
  };
}

// Helper to build an OnboardingAnswerRecord
function makeAnswer(
  questionKey: string,
  value: unknown,
  step: 1 | 2 = 1,
  order: number = 1
): OnboardingAnswerRecord {
  return {
    questionKey,
    step,
    order,
    type: 'multi_select',
    title: questionKey,
    value,
    answerText: null,
  };
}

describe('computePreferenceScore', () => {
  it('returns 0 for a job that matches nothing', () => {
    const job = makeJob({ title: 'Unknown Role', location: 'Mars', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_areas: makeAnswer('work_areas', ['data_scientist']),
      regions: makeAnswer('regions', ['canada']),
      role_types: makeAnswer('role_types', ['contract'], 1, 3),
      work_style: makeAnswer('work_style', 'remote', 1, 5),
      career_levels: makeAnswer('career_levels', ['executive_leadership'], 1, 2),
    };
    // Mars matches no region, Unknown Role matches no work area keyword or seniority,
    // isRemote=false doesn't match remote work_style, no contract jobType
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(0);
  });

  it('returns 30 when only work_areas match (job title contains role family keyword)', () => {
    const job = makeJob({ title: 'Software Engineer II', location: 'Mars', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_areas: makeAnswer('work_areas', ['software_engineer']),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(30);
  });

  it('returns 25 when only regions match (job location contains region)', () => {
    const job = makeJob({ title: 'Unknown Role', location: 'Canada, Toronto', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      regions: makeAnswer('regions', ['canada'], 1, 4),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(25);
  });

  it('returns 20 when only role_types match (job.jobType matches)', () => {
    const job = makeJob({ title: 'Unknown Role', location: 'Mars', jobType: 'fulltime', isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      role_types: makeAnswer('role_types', ['full_time'], 1, 3),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(20);
  });

  it('returns 15 when work_style matches remote (job.isRemote=true, work_style=remote)', () => {
    const job = makeJob({ title: 'Unknown Role', location: 'Mars', jobType: null, isRemote: true });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_style: makeAnswer('work_style', 'remote', 1, 5),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(15);
  });

  it('returns 10 when career_levels match (job title contains seniority keyword)', () => {
    const job = makeJob({ title: 'Senior Data Analyst', location: 'Mars', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      career_levels: makeAnswer('career_levels', ['senior_manager'], 1, 2),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(10);
  });

  it('returns 100 (capped) when all signals match', () => {
    const job = makeJob({
      title: 'Senior Software Engineer',
      location: 'United States, Remote',
      jobType: 'fulltime',
      isRemote: true,
    });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_areas: makeAnswer('work_areas', ['software_engineer']),
      career_levels: makeAnswer('career_levels', ['senior_manager'], 1, 2),
      role_types: makeAnswer('role_types', ['full_time'], 1, 3),
      regions: makeAnswer('regions', ['united_states'], 1, 4),
      work_style: makeAnswer('work_style', 'remote', 1, 5),
    };
    // 30 + 25 + 20 + 15 + 10 = 100
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(100);
  });

  it('returns value between 0-100 inclusive for any input', () => {
    const jobs = [
      makeJob({ title: 'CEO', location: 'Worldwide Remote', jobType: 'fulltime', isRemote: true }),
      makeJob({ title: 'Intern Developer', location: 'Canada', jobType: 'internship', isRemote: false }),
      makeJob({ title: 'Mid-level Data Scientist', location: null, jobType: null }),
    ];

    const answers: Record<string, OnboardingAnswerRecord> = {
      work_areas: makeAnswer('work_areas', ['data_scientist', 'software_engineer']),
      career_levels: makeAnswer('career_levels', ['executive_leadership', 'early_career'], 1, 2),
      role_types: makeAnswer('role_types', ['full_time', 'internship'], 1, 3),
      regions: makeAnswer('regions', ['canada', 'remote_worldwide'], 1, 4),
      work_style: makeAnswer('work_style', 'flexible', 1, 5),
    };

    for (const job of jobs) {
      const score = computePreferenceScore(job, answers);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    }
  });

  it('work_style flexible always awards 15 regardless of job remote status', () => {
    const jobOnsite = makeJob({ title: 'Unknown', location: 'Mars', isRemote: false, jobType: null });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_style: makeAnswer('work_style', 'flexible', 1, 5),
    };
    const score = computePreferenceScore(jobOnsite, answers);
    expect(score).toBe(15);
  });

  it('remote_worldwide region matches if job location contains "remote"', () => {
    const job = makeJob({ title: 'Unknown', location: 'Remote (Global)', isRemote: true, jobType: null });
    const answers: Record<string, OnboardingAnswerRecord> = {
      regions: makeAnswer('regions', ['remote_worldwide'], 1, 4),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(25);
  });

  it('freelance maps to contract job type', () => {
    const job = makeJob({ title: 'Unknown', location: 'Mars', jobType: 'contract', isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      role_types: makeAnswer('role_types', ['freelance'], 1, 3),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(20);
  });

  it('onsite work_style matches job where isRemote is false', () => {
    const job = makeJob({ title: 'Unknown', location: 'New York', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      work_style: makeAnswer('work_style', 'onsite', 1, 5),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(15);
  });

  it('early_career matches junior/entry keywords in job title', () => {
    const job = makeJob({ title: 'Junior Developer', location: 'Mars', jobType: null, isRemote: false });
    const answers: Record<string, OnboardingAnswerRecord> = {
      career_levels: makeAnswer('career_levels', ['early_career'], 1, 2),
    };
    const score = computePreferenceScore(job, answers);
    expect(score).toBe(10);
  });
});
