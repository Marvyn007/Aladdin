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
    async upsertJob(job: NormalizedJob): Promise<{ isNew: boolean; stale: boolean }> {
      // Priority 1 (authoritative): freshness gate — drop stale jobs before touching the DB
      const { isFresh } = await import('./freshness')
      if (!isFresh(job)) {
        return { isNew: false, stale: true }
      }

      const { validateJobDescription } = await import('../job-validation')
      const validation = validateJobDescription(job.jobDescriptionPlain || '')
      if (!validation.valid) {
        // Silently drop invalid scraped jobs to avoid polluting logs with exceptions,
        // while preventing them from entering the database.
        return { isNew: false, stale: false }
      }

      // Primary dedupe: source + externalId
      // For now source/externalId are nullable in the schema (Phase 6 makes them non-nullable).
      // Use raw SQL with ON CONFLICT to handle atomically.
      const result = await prisma.$queryRawUnsafe<{ is_new: boolean }[]>(
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
          DO NOTHING
        RETURNING true as is_new
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

      if (job.company) {
        try {
          const companyExists = await prisma.company.findUnique({ where: { name: job.company } })
          if (!companyExists || !companyExists.logoFetched) {
            const logoRes = await fetch(`https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(job.company)}`)
            if (logoRes.ok) {
              const suggestions = await logoRes.json()
              const bestMatch = suggestions.length > 0 ? suggestions[0] : null
              const finalLogoUrl = bestMatch?.logo || (bestMatch?.domain ? `https://logo.clearbit.com/${bestMatch.domain}` : null)
              
              await prisma.company.upsert({
                where: { name: job.company },
                create: {
                  name: job.company,
                  domain: bestMatch?.domain || null,
                  logoUrl: finalLogoUrl,
                  logoFetched: true,
                },
                update: {
                  ...(bestMatch?.domain ? { domain: bestMatch.domain } : {}),
                  ...(finalLogoUrl ? { logoUrl: finalLogoUrl } : {}),
                  logoFetched: true,
                }
              })
            }
          }
        } catch (e) {
          console.error(`[worker-db] Failed to fetch logo for ${job.company}`, e)
        }
      }

      return { isNew: result.length > 0, stale: false }
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
