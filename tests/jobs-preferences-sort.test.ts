/**
 * Integration tests for preference-based job sorting in /api/jobs
 *
 * Tests:
 * - sortBy=preferences with completed onboarding: jobs sorted by score DESC
 * - sortBy=preferences with incomplete onboarding: falls back to time sort (no error)
 * - sortBy=preferences with no userId: falls back to time sort (no error)
 * - All jobs returned regardless of score (no filtering)
 * - computePreferenceScore called for each job with answersByKey
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Mock auth from Clerk
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock DB functions
vi.mock('@/lib/db', () => ({
  getAllPublicJobs: vi.fn(),
  getTotalPublicJobsCount: vi.fn(),
  getLastJobIngestionTime: vi.fn(),
  getJobs: vi.fn(),
}));

// Mock onboarding-db
vi.mock('@/lib/onboarding-db', () => ({
  getOnboardingSnapshot: vi.fn(),
}));

// Mock preference-scoring
vi.mock('@/lib/preference-scoring', () => ({
  computePreferenceScore: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { getAllPublicJobs, getTotalPublicJobsCount, getLastJobIngestionTime } from '@/lib/db';
import { getOnboardingSnapshot } from '@/lib/onboarding-db';
import { computePreferenceScore } from '@/lib/preference-scoring';
import type { Job } from '@/types';
import type { OnboardingSnapshot } from '@/lib/onboarding-db';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeJob(id: string, overrides: Partial<Job> = {}): Job {
  return {
    id,
    title: `Job ${id}`,
    company: 'Acme Corp',
    location: 'Remote',
    source_url: `https://example.com/${id}`,
    posted_at: '2026-01-01T00:00:00Z',
    fetched_at: '2026-01-02T00:00:00Z',
    status: 'fresh',
    normalized_text: null,
    raw_text_summary: null,
    content_hash: null,
    ...overrides,
  };
}

function makeCompletedSnapshot(): OnboardingSnapshot {
  return {
    state: { status: 'complete', currentStep: 2, startedAt: null, completedAt: null, updatedAt: null },
    answers: [{ questionKey: 'work_areas', step: 1, order: 1, type: 'multi_select', title: 'Work Areas', value: ['software_engineer'], answerText: 'Software Engineer', updatedAt: null }],
    answersByKey: {
      work_areas: { questionKey: 'work_areas', step: 1, order: 1, type: 'multi_select', title: 'Work Areas', value: ['software_engineer'], answerText: 'Software Engineer', updatedAt: null },
    },
    requiredAnswered: 1,
    requiredTotal: 1,
    progress: 100,
    completed: true,
  };
}

function makeIncompleteSnapshot(): OnboardingSnapshot {
  return {
    state: { status: 'in_progress', currentStep: 1, startedAt: null, completedAt: null, updatedAt: null },
    answers: [],
    answersByKey: {},
    requiredAnswered: 0,
    requiredTotal: 5,
    progress: 0,
    completed: false,
  };
}

function makeRequest(params: Record<string, string>): Request {
  const url = new URL('http://localhost:3000/api/jobs');
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Request(url.toString());
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/jobs with sortBy=preferences', () => {
  const job1 = makeJob('job-1', { title: 'Software Engineer' });
  const job2 = makeJob('job-2', { title: 'Data Scientist' });
  const job3 = makeJob('job-3', { title: 'Software Lead' });
  const baseJobs = [job1, job2, job3];

  beforeEach(() => {
    vi.clearAllMocks();
    (getTotalPublicJobsCount as ReturnType<typeof vi.fn>).mockResolvedValue(3);
    (getLastJobIngestionTime as ReturnType<typeof vi.fn>).mockResolvedValue(new Date().toISOString());
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('sorts jobs by preference score DESC for authenticated user with completed onboarding', async () => {
    // job1 score=80, job2 score=10, job3 score=60 => sorted: job1, job3, job2
    const scores: Record<string, number> = { 'job-1': 80, 'job-2': 10, 'job-3': 60 };

    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);
    (getOnboardingSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(makeCompletedSnapshot());
    (computePreferenceScore as ReturnType<typeof vi.fn>).mockImplementation(
      (job: Job) => scores[job.id] ?? 0
    );

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(3);
    expect(body.jobs[0].id).toBe('job-1'); // score 80
    expect(body.jobs[1].id).toBe('job-3'); // score 60
    expect(body.jobs[2].id).toBe('job-2'); // score 10
  });

  it('calls computePreferenceScore for each job with answersByKey from snapshot', async () => {
    const snapshot = makeCompletedSnapshot();
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);
    (getOnboardingSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(snapshot);
    (computePreferenceScore as ReturnType<typeof vi.fn>).mockReturnValue(50);

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    await GET(req as any);

    // computePreferenceScore called once per job with the snapshot's answersByKey
    expect(computePreferenceScore).toHaveBeenCalledTimes(3);
    expect(computePreferenceScore).toHaveBeenCalledWith(expect.any(Object), snapshot.answersByKey);
  });

  it('falls back to time sort when user has not completed onboarding', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);
    (getOnboardingSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(makeIncompleteSnapshot());

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(3);
    // Order unchanged (time order from DB)
    expect(body.jobs[0].id).toBe('job-1');
    expect(body.jobs[1].id).toBe('job-2');
    expect(body.jobs[2].id).toBe('job-3');
    // Score computation not called
    expect(computePreferenceScore).not.toHaveBeenCalled();
  });

  it('falls back to time sort when no userId (unauthenticated)', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: null });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(3);
    expect(getOnboardingSnapshot).not.toHaveBeenCalled();
    expect(computePreferenceScore).not.toHaveBeenCalled();
  });

  it('returns all jobs regardless of score (no filtering)', async () => {
    // All jobs get score 0 -- they should all still be returned
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);
    (getOnboardingSnapshot as ReturnType<typeof vi.fn>).mockResolvedValue(makeCompletedSnapshot());
    (computePreferenceScore as ReturnType<typeof vi.fn>).mockReturnValue(0);

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    const res = await GET(req as any);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(3); // all 3 returned, nothing filtered out
  });

  it('gracefully falls back to time sort if getOnboardingSnapshot throws', async () => {
    (auth as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ userId: 'user-123' });
    (getAllPublicJobs as ReturnType<typeof vi.fn>).mockResolvedValue([...baseJobs]);
    (getOnboardingSnapshot as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const { GET } = await import('@/app/api/jobs/route');
    const req = makeRequest({ sort_by: 'preferences' });
    const res = await GET(req as any);
    const body = await res.json();

    // Should not return 500 -- graceful fallback
    expect(res.status).toBe(200);
    expect(body.jobs).toHaveLength(3);
  });
});
