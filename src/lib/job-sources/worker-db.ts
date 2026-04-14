import type { PrismaClient, Prisma } from '@prisma/client'
import type { WorkerDb } from './worker'
import type { NormalizedJob } from './types'
import type { DiscoveryDb } from './discovery'
import type { DiscoveryCandidate } from './discovery-candidates'

/**
 * Prisma-backed WorkerDb implementation.
 * Handles job upsert (source+externalId dedupe), TrackedCompany updates, and poll logging.
 */
export function createWorkerDb(prisma: PrismaClient): WorkerDb {
  return {
    async upsertJob(job: NormalizedJob): Promise<{ isNew: boolean; stale: boolean; jobId: string | null }> {
      // Priority 1 (authoritative): freshness gate — drop stale jobs before touching the DB
      const { isFresh } = await import('./freshness')
      if (!isFresh(job)) {
        return { isNew: false, stale: true, jobId: null }
      }

      // Priority 1b: description quality check — drop jobs with empty or broken descriptions (< 50 chars)
      // Now that extraction is fixed across adapters, we only drop entries that are likely errors.
      if (!job.jobDescriptionPlain || job.jobDescriptionPlain.length < 50) {
        return { isNew: false, stale: true, jobId: null }
      }

      // Primary dedupe: source + externalId
      // For now source/externalId are nullable in the schema (Phase 6 makes them non-nullable).
      // Use raw SQL with ON CONFLICT to handle atomically.
      const result = await prisma.$queryRawUnsafe<{ id: string; is_new: boolean }[]>(
        `
        INSERT INTO jobs (
          id, title, company, location, source_url, posted_at,
          raw_description_html, job_description_plain, content_hash,
          source, external_id,
          salary_min, salary_max, salary_currency,
          job_type, is_remote, experience_level, skills,
          apply_url, expires_at
        )
        VALUES (
          gen_random_uuid(), $1, $2, $3, $4, $5,
          $6, $7, $8,
          $9, $10,
          $11, $12, $13,
          $14, $15, $16, $17::jsonb,
          $18, $19
        )
        ON CONFLICT (source, external_id)
          WHERE source IS NOT NULL AND external_id IS NOT NULL
          DO UPDATE SET
            posted_at = EXCLUDED.posted_at,
            raw_description_html = EXCLUDED.raw_description_html,
            job_description_plain = EXCLUDED.job_description_plain,
            updated_at = NOW()
        RETURNING id, (xmax = 0) AS is_new
        `,
        job.title,
        job.company,
        job.location,
        job.sourceUrl,
        job.postedAt,
        job.rawDescriptionHtml,
        job.jobDescriptionPlain,
        job.contentHash,
        job.source,
        job.externalId,
        job.salaryMin,
        job.salaryMax,
        job.salaryCurrency,
        job.jobType,
        job.isRemote,
        job.experienceLevel,
        JSON.stringify(job.skills),
        job.applyUrl,
        job.expiresAt
      )

      const isNew = result[0]?.is_new === true
      const jobId = result[0]?.id ?? null

      // Only create company record if it doesn't exist — keeps basic company list up to date
      if (isNew && job.company) {
        try {
          const companyExists = await prisma.company.findUnique({ where: { name: job.company } })
          if (!companyExists) {
            await prisma.company.create({
              data: {
                name: job.company,
                logoUrl: null,
                logoFetched: false,
              }
            })
          }
        } catch (e) {
          console.error(`[worker-db] Failed to ensure company record for ${job.company}`, e)
        }
      }

      return { isNew, stale: false, jobId }
    },

    async updateTrackedCompany(
      slug: string,
      ats: string,
      update: { lastJobCount: number; hasJobs: boolean }
    ): Promise<void> {
      const now = new Date()
      await prisma.trackedCompany.updateMany({
        where: { slug, ats },
        data: {
          lastPolledAt: now,
          lastJobCount: update.lastJobCount,
          errorCount: 0, // Reset on successful poll
          ...(update.hasJobs ? { lastNonEmptyAt: now, suspectEmpty: false } : {}),
        },
      })
    },

    async logPoll(log: {
      source: string
      slug: string | null
      jobsFetched: number
      newJobs: number
      duplicates: number
      stale: number
      durationMs: number
      error: string | null
    }): Promise<void> {
      await prisma.sourcePollLog.create({
        data: {
          source: log.source,
          slug: log.slug,
          jobsFetched: log.jobsFetched,
          newJobs: log.newJobs,
          duplicates: log.duplicates,
          stale: log.stale,
          durationMs: log.durationMs,
          error: log.error,
        },
      })
    },
  }
}

export function createDiscoveryDb(prisma: PrismaClient): DiscoveryDb {
  return {
    async getTrackedSlugs(): Promise<Set<string>> {
      const companies = await prisma.trackedCompany.findMany({
        select: { slug: true, ats: true },
      })
      return new Set(companies.map(c => `${c.slug}::${c.ats}`))
    },

    async insertTrackedCompany(candidate: DiscoveryCandidate): Promise<void> {
      try {
        await prisma.trackedCompany.create({
          data: {
            slug: candidate.slug,
            name: candidate.name,
            ats: candidate.ats,
            industry: candidate.industry ?? null,
            country: candidate.country ?? null,
            addedBy: 'discovery',
            isActive: true,
          },
        })
      } catch (err) {
        // Unique constraint violation = already tracked — swallow silently
        if (
          err instanceof Error &&
          'code' in err &&
          (err as { code: string }).code === 'P2002'
        ) {
          return
        }
        throw err
      }
    },
  }
}
