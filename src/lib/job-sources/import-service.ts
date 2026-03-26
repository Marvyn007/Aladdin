import { prisma } from '@/lib/prisma'
import { generateContentHash, generateFallbackId } from './helpers'

export interface ImportJobInput {
  title: string
  company: string
  location: string
  sourceUrl: string
  applyUrl: string | null
  rawDescriptionHtml: string | null
  jobDescriptionPlain: string | null
  postedByUserId: string
}

export interface ImportJobResult {
  job: { id: string; [key: string]: unknown }
  isDuplicate: boolean
}

/**
 * Import a user-submitted job into the system.
 *
 * Dedup strategy:
 * 1. Generate contentHash from (title, company, location, sourceUrl)
 * 2. If a job with that contentHash already exists (from any source), return it
 * 3. Otherwise, insert with source='imported' and deterministic externalId
 */
export async function importJob(input: ImportJobInput): Promise<ImportJobResult> {
  const contentHash = generateContentHash(
    input.title,
    input.company,
    input.location,
    input.sourceUrl
  )

  // Check for existing job with same contentHash (cross-source duplicate)
  const existing = await prisma.job.findFirst({
    where: { contentHash },
  })

  if (existing) {
    return { job: existing, isDuplicate: true }
  }

  // Generate deterministic externalId for this imported job
  const externalId = generateFallbackId(
    input.title,
    input.company,
    input.location,
    input.applyUrl
  )

  const job = await prisma.job.create({
    data: {
      title: input.title,
      company: input.company,
      location: input.location,
      sourceUrl: input.sourceUrl,
      rawDescriptionHtml: input.rawDescriptionHtml,
      jobDescriptionPlain: input.jobDescriptionPlain,
      contentHash,
      source: 'imported',
      externalId,
      isImported: 1,
      importTag: 'imported',
      postedByUserId: input.postedByUserId,
      applyUrl: input.applyUrl,
    },
  })

  return { job, isDuplicate: false }
}
