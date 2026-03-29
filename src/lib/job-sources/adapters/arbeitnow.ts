import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain } from '../helpers'

const ARBEITNOW_API_BASE = 'https://www.arbeitnow.com/api/job-board-api'
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single job from the Arbeitnow API */
interface ArbeitnowJob {
  slug: string
  company_name: string
  title: string
  description: string
  remote: boolean
  url: string
  tags: string[]
  job_types: string[]
  location: string
  created_at: number
}

interface ArbeitnowResponse {
  data: ArbeitnowJob[]
  links: Record<string, string | null>
  meta: Record<string, unknown>
}

export class ArbeitnowAdapter implements SourceAdapter {
  name = 'arbeitnow' as const

  private lastRequestAt = 0
  private stalePagesInARow = 0

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed))
    }
    this.lastRequestAt = Date.now()
  }

  async poll(target: PollTarget): Promise<NormalizedJob[]> {
    const page = target.type === 'bulk' ? (target.page ?? 1) : 1

    await this.rateLimit()

    const url = `${ARBEITNOW_API_BASE}?page=${page}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Arbeitnow API error: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      if (!data || typeof data !== 'object' || !Array.isArray(data.data)) {
        throw new Error('Arbeitnow API returned unexpected shape')
      }

      const arbeitnowData = data as ArbeitnowResponse
      const normalized = arbeitnowData.data
        .map((job) => this.normalize(job))
        .filter((job) => !this.isGermanDescription(job.jobDescriptionPlain || ''))

      // Priority 2: bulk paging early exit
      const { shouldStopPaging, isFresh } = await import('../freshness')
      const { stop, newCounter } = shouldStopPaging(normalized, this.stalePagesInARow)
      this.stalePagesInARow = stop ? 0 : newCounter

      // Priority 3: pre-filter stale before returning
      return normalized.filter((job) => isFresh(job))
    } finally {
      clearTimeout(timeout)
    }
  }

  async healthCheck(): Promise<SourceHealth> {
    const start = Date.now()
    try {
      const response = await fetch(
        `${ARBEITNOW_API_BASE}?page=1`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'arbeitnow',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'arbeitnow',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(job: ArbeitnowJob): NormalizedJob {
    const location = job.location ?? ''
    const sourceUrl = job.url ?? ''
    const company = job.company_name ?? ''

    return {
      title: job.title,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: job.description || null,
      jobDescriptionPlain: stripHtmlToPlain(job.description),
      postedAt: job.created_at ? new Date(job.created_at * 1000) : null,
      contentHash: generateContentHash(job.title, company, location, sourceUrl),
      source: 'arbeitnow',
      externalId: job.slug,
      metadata: {
        tags: job.tags ?? [],
        job_types: job.job_types ?? [],
      },
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      jobType: this.mapJobType(job.job_types),
      isRemote: job.remote === true,
      experienceLevel: null,
      skills: [],
      applyUrl: sourceUrl || null,
      expiresAt: null,
    }
  }

  private isGermanDescription(text: string): boolean {
    if (!text) return false
    const lower = text.toLowerCase()
    // Common German words that strongly indicate the job is written in German
    const germanWords = [' und ', ' der ', ' die ', ' das ', ' für ', ' wir ', ' sind ']
    let matchCount = 0
    for (const word of germanWords) {
      if (lower.includes(word)) matchCount++
    }
    // If we find at least 2 common German words, consider it German
    return matchCount >= 2
  }

  private mapJobType(
    jobTypes: string[]
  ): 'fulltime' | 'parttime' | 'contract' | 'internship' | null {
    if (!jobTypes || jobTypes.length === 0) return null

    const normalized = jobTypes.map((t) => t.toLowerCase())
    if (normalized.some((t) => t.includes('full'))) return 'fulltime'
    if (normalized.some((t) => t.includes('part') || t.includes('teilzeit'))) return 'parttime'
    if (normalized.some((t) => t.includes('contract') || t.includes('freelance'))) return 'contract'
    if (normalized.some((t) => t.includes('intern'))) return 'internship'
    return null
  }
}
