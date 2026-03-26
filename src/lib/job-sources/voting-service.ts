import { prisma } from '@/lib/prisma'

export interface VoteInput {
  userId: string
  jobId: string
  value: 1 | -1
}

export interface VoteResult {
  vote: { id: string; userId: string; jobId: string; value: number } | null
  netScore: number
}

/**
 * Cast or toggle a vote on a job.
 *
 * - If no existing vote: creates new vote
 * - If same value already exists: removes vote (toggle off)
 * - If different value: switches vote
 */
export async function castVote(input: VoteInput): Promise<VoteResult> {
  if (input.value !== 1 && input.value !== -1) {
    throw new Error('Invalid vote value: must be 1 or -1')
  }

  const existing = await prisma.jobVote.findUnique({
    where: {
      userId_jobId: { userId: input.userId, jobId: input.jobId },
    },
  })

  let vote: VoteResult['vote'] = null

  if (existing && existing.value === input.value) {
    // Toggle off: same value → remove
    await prisma.jobVote.delete({
      where: { id: existing.id },
    })
  } else {
    // New vote or switch value
    const result = await prisma.jobVote.upsert({
      where: {
        userId_jobId: { userId: input.userId, jobId: input.jobId },
      },
      create: {
        userId: input.userId,
        jobId: input.jobId,
        value: input.value,
      },
      update: {
        value: input.value,
      },
    })
    vote = result
  }

  const netScore = await getJobVoteScore(input.jobId)

  return { vote, netScore }
}

/**
 * Get the net vote score for a job (sum of all vote values).
 */
export async function getJobVoteScore(jobId: string): Promise<number> {
  const result = await prisma.jobVote.aggregate({
    where: { jobId },
    _sum: { value: true },
  })

  return result._sum.value ?? 0
}

/**
 * Get the current user's vote on a job, or null if not voted.
 */
export async function getUserVote(
  userId: string,
  jobId: string
): Promise<number | null> {
  const vote = await prisma.jobVote.findUnique({
    where: {
      userId_jobId: { userId, jobId },
    },
  })

  return vote?.value ?? null
}
