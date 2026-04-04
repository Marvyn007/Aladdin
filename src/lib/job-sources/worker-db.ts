import type { PrismaClient, Prisma } from '@prisma/client'
import type { WorkerDb } from './worker'
import type { NormalizedJob } from './types'
import type { DiscoveryDb } from './discovery'
import type { DiscoveryCandidate } from './discovery-candidates'
import { getCompanyLogo } from '../logo-dev'
import { scrapeLogoFromProviderPage } from '../company'

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

      // Priority 1b: description quality check — drop jobs with empty or broken descriptions (< 100 chars)
      // Now that extraction is fixed across adapters, we only drop entries that are likely errors.
      if (!job.jobDescriptionPlain || job.jobDescriptionPlain.length < 100) {
        return { isNew: false, stale: true }
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

      const isNew = result.length > 0

      // Only resolve logos for brand-new jobs — avoids expensive external HTTP calls on duplicates
      if (isNew && job.company) {
        try {
          const companyExists = await prisma.company.findUnique({ where: { name: job.company } })
          
          // ONLY auto-fetch the VERY FIRST TIME the company is added to the database.
          // If the company already exists, we do NOT touch its logo/domain here.
          if (!companyExists) {
            // 1. Try scraping logo directly from the provider job page (highest quality)
            let logoUrl: string | null = null
            let domain: string | null = null

            const providerLogo = await scrapeLogoFromProviderPage(job.sourceUrl, job.source)
            if (providerLogo?.logoUrl) {
              logoUrl = providerLogo.logoUrl
            } else {
              // 2. Fall back to logo.dev
              const result = await getCompanyLogo(job.company)
              logoUrl = result.logoUrl
              domain = result.domain ?? null
            }

            if (logoUrl) {
              await prisma.company.create({
                data: {
                  name: job.company,
                  domain: domain,
                  logoUrl: logoUrl,
                  logoFetched: true,
                }
              })

              // Also update TrackedCompany if it exists and is missing a logo
              await prisma.trackedCompany.updateMany({
                where: { name: job.company, logoUrl: null },
                data: { logoUrl: logoUrl }
              })
            }
          }
        } catch (e) {
          console.error(`[worker-db] Failed to resolve logo for ${job.company}`, e)
        }
      }

      return { isNew, stale: false }
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
