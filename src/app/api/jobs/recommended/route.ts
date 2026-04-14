import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const SCORE_THRESHOLD = 40
const MIN_COUNT = 50
const FALLBACK_COUNT = 50
const MAX_SCORED = 100

export async function GET() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check if user has any precomputed scores
  const scoreCount = await prisma.jobScore.count({ where: { userId } })

  if (scoreCount === 0) {
    // Cold start — return recent jobs as fallback
    const recentJobs = await prisma.job.findMany({
      where: { status: 'fresh' },
      orderBy: { postedAt: 'desc' },
      take: FALLBACK_COUNT,
    })
    return NextResponse.json({
      status: 'pending',
      jobs: recentJobs.map(mapJob),
      message: 'Recommendations loading — showing recent jobs in the meantime.',
    })
  }

  // Fetch top scored active jobs
  const scored = await prisma.jobScore.findMany({
    where: { userId, job: { status: 'fresh' } },
    orderBy: { score: 'desc' },
    take: MAX_SCORED,
    include: {
      job: true,
    },
  })

  // Threshold logic: return jobs with score ≥ 40, but always at least MIN_COUNT
  const above = scored.filter((s) => s.score >= SCORE_THRESHOLD)
  const chosen = above.length >= MIN_COUNT ? above : scored.slice(0, MIN_COUNT)

  return NextResponse.json({
    status: 'ready',
    jobs: chosen.map((s) => ({ ...mapJob(s.job), _score: s.score })),
  })
}

type PrismaJob = Awaited<ReturnType<typeof prisma.job.findMany>>[number]

function mapJob(j: PrismaJob) {
  return {
    id: j.id,
    title: j.title,
    company: j.company,
    location: j.location,
    source_url: j.sourceUrl,
    posted_at: j.postedAt?.toISOString() ?? null,
    fetched_at: j.fetchedAt?.toISOString() ?? new Date().toISOString(),
    status: j.status ?? 'fresh',
    job_description_plain: j.jobDescriptionPlain,
    skills: Array.isArray(j.skills) ? j.skills : [],
    jobType: j.jobType,
    isRemote: j.isRemote,
    location_display: j.locationDisplay,
    company_logo_url: null,
    applyUrl: j.applyUrl,
    salaryMin: j.salaryMin,
    salaryMax: j.salaryMax,
    salaryCurrency: j.salaryCurrency,
    experienceLevel: j.experienceLevel,
    source: j.source,
    externalId: j.externalId,
  }
}
