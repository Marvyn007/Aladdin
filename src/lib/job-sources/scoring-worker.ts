import { prisma } from '@/lib/prisma'
import { getOnboardingSnapshot } from '@/lib/onboarding-db'
import { computePreferenceScore } from '@/lib/preference-scoring'
import type { QueueAdapter, QueueTask } from '@/lib/queue/types'
import type { Job } from '@/types'

const JOB_BATCH_SIZE = 250
const USER_BATCH_SIZE = 500

// ─── handleScoreUserPreferences ───────────────────────────────────────────────

/**
 * Score all active jobs for a single user.
 * Payload: { userId: string }
 */
export async function handleScoreUserPreferences(
  task: QueueTask,
  _queue: QueueAdapter
): Promise<void> {
  const userId = task.payload.userId as string
  const start = Date.now()

  const snapshot = await getOnboardingSnapshot(userId)
  if (!snapshot.completed) {
    console.log(`[scoring-worker] score-user-preferences: user ${userId} onboarding not complete — skipping`)
    return
  }

  const { answersByKey } = snapshot

  let totalScored = 0
  let batchCount = 0
  let cursor: string | undefined

  while (true) {
    const jobs = await prisma.job.findMany({
      where: { status: 'fresh' },
      take: JOB_BATCH_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        sourceUrl: true,
        status: true,
        jobDescriptionPlain: true,
        skills: true,
        jobType: true,
        isRemote: true,
      },
    })

    if (jobs.length === 0) break

    const upserts = jobs.map((prismaJob) => {
      const job = toScoringJob(prismaJob)
      const score = computePreferenceScore(job, answersByKey)
      return { userId, jobId: prismaJob.id, score }
    })

    await Promise.all(
      upserts.map(({ userId: uid, jobId, score }) =>
        prisma.jobScore.upsert({
          where: { userId_jobId: { userId: uid, jobId } },
          create: { userId: uid, jobId, score, confidence: 1.0, breakdown: {}, scoredAt: new Date() },
          update: { score, scoredAt: new Date() },
        })
      )
    )

    totalScored += jobs.length
    batchCount++
    cursor = jobs[jobs.length - 1].id

    if (jobs.length < JOB_BATCH_SIZE) break
  }

  const durationMs = Date.now() - start
  console.log(`[scoring-worker] score-user-preferences: userId=${userId} totalScored=${totalScored} batches=${batchCount} durationMs=${durationMs}`)
}

// ─── handleScoreNewJob ────────────────────────────────────────────────────────

/**
 * Score a new job against all users with completed onboarding.
 * Payload: { jobId: string }
 */
export async function handleScoreNewJob(
  task: QueueTask,
  _queue: QueueAdapter
): Promise<void> {
  const jobId = task.payload.jobId as string
  const start = Date.now()

  const prismaJob = await prisma.job.findUnique({
    where: { id: jobId },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      sourceUrl: true,
      status: true,
      jobDescriptionPlain: true,
      skills: true,
      jobType: true,
      isRemote: true,
    },
  })

  if (!prismaJob) {
    console.warn(`[scoring-worker] score-new-job: job ${jobId} not found — skipping`)
    return
  }

  const job = toScoringJob(prismaJob)

  let totalScored = 0
  let batchCount = 0
  let offset = 0

  while (true) {
    const onboardingStates = await prisma.onboardingState.findMany({
      where: { status: 'complete' },
      select: { userId: true },
      take: USER_BATCH_SIZE,
      skip: offset,
    })

    if (onboardingStates.length === 0) break

    const snapshots = await Promise.all(
      onboardingStates.map((os) => getOnboardingSnapshot(os.userId))
    )

    await Promise.all(
      onboardingStates.map(async (os, i) => {
        const snapshot = snapshots[i]
        if (!snapshot.completed) return
        const score = computePreferenceScore(job, snapshot.answersByKey)
        await prisma.jobScore.upsert({
          where: { userId_jobId: { userId: os.userId, jobId } },
          create: { userId: os.userId, jobId, score, confidence: 1.0, breakdown: {}, scoredAt: new Date() },
          update: { score, scoredAt: new Date() },
        })
      })
    )

    totalScored += onboardingStates.length
    batchCount++
    offset += onboardingStates.length

    if (onboardingStates.length < USER_BATCH_SIZE) break
  }

  const durationMs = Date.now() - start
  console.log(`[scoring-worker] score-new-job: jobId=${jobId} totalScored=${totalScored} batches=${batchCount} durationMs=${durationMs}`)
}

// ─── handleScoreRefresh ───────────────────────────────────────────────────────

/**
 * Enqueue score-user-preferences for users whose scores are older than 24 hours.
 * Called by daily cron.
 */
export async function handleScoreRefresh(queue: QueueAdapter): Promise<void> {
  const start = Date.now()
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)

  // Find users with completed onboarding whose latest score is stale (or missing)
  const staleUsers = await prisma.$queryRaw<{ user_id: string }[]>`
    SELECT os.user_id
    FROM user_onboarding_state os
    LEFT JOIN (
      SELECT user_id, MAX(scored_at) AS latest_scored_at
      FROM job_scores
      GROUP BY user_id
    ) js ON js.user_id = os.user_id
    WHERE os.status = 'complete'
      AND (js.latest_scored_at IS NULL OR js.latest_scored_at < ${cutoff})
  `

  let enqueued = 0
  for (const row of staleUsers) {
    await queue.enqueue({
      type: 'score-user-preferences',
      payload: { userId: row.user_id },
      priority: 3,
    })
    enqueued++
  }

  const durationMs = Date.now() - start
  console.log(`[scoring-worker] score-refresh: enqueued=${enqueued} durationMs=${durationMs}`)
}

// ─── Helper ───────────────────────────────────────────────────────────────────

type PrismaJobSelect = {
  id: string
  title: string
  company: string | null
  location: string | null
  sourceUrl: string
  status: string | null
  jobDescriptionPlain: string | null
  skills: unknown
  jobType: string | null
  isRemote: boolean
}

function toScoringJob(p: PrismaJobSelect): Job {
  return {
    id: p.id,
    title: p.title,
    company: p.company,
    location: p.location,
    source_url: p.sourceUrl,
    posted_at: null,
    fetched_at: new Date().toISOString(),
    status: (p.status ?? 'fresh') as Job['status'],
    normalized_text: null,
    raw_text_summary: null,
    content_hash: null,
    job_description_plain: p.jobDescriptionPlain,
    skills: Array.isArray(p.skills) ? (p.skills as string[]) : [],
    jobType: (p.jobType as Job['jobType']) ?? null,
    isRemote: p.isRemote,
  }
}
