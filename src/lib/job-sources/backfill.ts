import { prisma } from '@/lib/prisma'
import { generateFallbackId } from './helpers'

export interface BackfillResult {
  updated: number
  duplicatesRemoved: number
  errors: string[]
}

/**
 * Domain-pattern → source mapping for backfilling existing jobs.
 */
const DOMAIN_SOURCE_MAP: Array<{ pattern: RegExp; source: string }> = [
  { pattern: /greenhouse\.io/i, source: 'greenhouse' },
  { pattern: /lever\.co/i, source: 'lever' },
  { pattern: /themuse\.com/i, source: 'themuse' },
  { pattern: /arbeitnow\.com/i, source: 'arbeitnow' },
  { pattern: /himalayas\.app/i, source: 'himalayas' },
]

/**
 * Infer source type from a job's sourceUrl domain.
 * Returns 'imported' for unknown domains or manual imports.
 */
export function inferSourceFromUrl(url: string): string {
  if (!url || url === 'manual-import') return 'imported'

  for (const { pattern, source } of DOMAIN_SOURCE_MAP) {
    if (pattern.test(url)) return source
  }

  return 'imported'
}

/**
 * Compute a richness score for duplicate resolution.
 * Higher = more data in the row.
 */
function richness(job: {
  jobDescriptionPlain?: string | null
  rawDescriptionHtml?: string | null
  salaryMin?: number | null
  location?: string | null
}): number {
  let score = 0
  if (job.jobDescriptionPlain) score += job.jobDescriptionPlain.length
  if (job.rawDescriptionHtml) score += 1000
  if (job.salaryMin) score += 500
  if (job.location) score += 100
  return score
}

/**
 * Backfill source and externalId for all jobs that are missing them.
 * Also deduplicates rows that would collide on (source, externalId).
 *
 * Safe to run multiple times — idempotent.
 */
export async function backfillJobs(): Promise<BackfillResult> {
  const result: BackfillResult = { updated: 0, duplicatesRemoved: 0, errors: [] }

  // Fetch all jobs that need backfill (missing source or externalId)
  const jobs = await prisma.job.findMany({
    where: {
      OR: [{ source: null }, { externalId: null }],
    },
    select: {
      id: true,
      title: true,
      company: true,
      location: true,
      sourceUrl: true,
      source: true,
      externalId: true,
      applyUrl: true,
      jobDescriptionPlain: true,
      rawDescriptionHtml: true,
      salaryMin: true,
    },
  })

  if (jobs.length === 0) return result

  // Phase 1: Compute source + externalId for each job
  const enriched = jobs.map((job) => {
    const source = job.source ?? inferSourceFromUrl(job.sourceUrl)
    const externalId =
      job.externalId ??
      generateFallbackId(
        job.title,
        job.company ?? '',
        job.location ?? '',
        job.applyUrl
      )
    return { ...job, computedSource: source, computedExternalId: externalId }
  })

  // Phase 2: Detect duplicates by (source, externalId)
  const groups = new Map<string, typeof enriched>()
  for (const job of enriched) {
    const key = `${job.computedSource}::${job.computedExternalId}`
    const group = groups.get(key) ?? []
    group.push(job)
    groups.set(key, group)
  }

  // Phase 3: Apply updates inside a transaction
  await prisma.$transaction(async (tx: any) => {
    for (const [, group] of groups) {
      // Sort by richness descending — keep the richest row
      group.sort((a, b) => richness(b) - richness(a))
      const keeper = group[0]
      const losers = group.slice(1)

      // Delete losers
      for (const loser of losers) {
        try {
          await tx.job.delete({ where: { id: loser.id } })
          result.duplicatesRemoved++
        } catch (err: any) {
          result.errors.push(`delete ${loser.id}: ${err.message}`)
        }
      }

      // Update keeper
      try {
        await tx.job.update({
          where: { id: keeper.id },
          data: {
            source: keeper.computedSource,
            externalId: keeper.computedExternalId,
          },
        })
        result.updated++
      } catch (err: any) {
        result.errors.push(`update ${keeper.id}: ${err.message}`)
      }
    }
  })

  return result
}
