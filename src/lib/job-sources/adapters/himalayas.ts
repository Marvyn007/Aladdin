import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain } from '../helpers'

const HIMALAYAS_API_BASE = 'https://himalayas.app/jobs/api'
const PAGE_SIZE = 50
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single job from the Himalayas API */
interface HimalayasJob {
  title: string
  excerpt: string
  companyName: string
  companySlug: string
  companyLogo: string
  employmentType: string
  minSalary: number | null
  maxSalary: number | null
  seniority: string[]
  currency: string
  locationRestrictions: string[]
  timezoneRestrictions: number[]
  categories: string[]
  parentCategories: string[]
  description: string
  pubDate: number
  expiryDate: number | null
  applicationLink: string
  guid: string
}

interface HimalayasResponse {
  jobs: HimalayasJob[]
  offset: number
  limit: number
  totalCount: number
  updatedAt?: number
}

export class HimalayasAdapter implements SourceAdapter {
  name = 'himalayas' as const

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
    const offset = (page - 1) * PAGE_SIZE

    await this.rateLimit()

    const url = `${HIMALAYAS_API_BASE}?limit=${PAGE_SIZE}&offset=${offset}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Himalayas API error: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      if (!data || typeof data !== 'object' || !Array.isArray(data.jobs)) {
        throw new Error('Himalayas API returned unexpected shape')
      }

      const himalayasData = data as HimalayasResponse
      const normalized = himalayasData.jobs.map((job) => this.normalize(job))

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
        `${HIMALAYAS_API_BASE}?limit=1&offset=0`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'himalayas',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'himalayas',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(job: HimalayasJob): NormalizedJob {
    const locations = job.locationRestrictions ?? []
    const location = locations.join('; ')
    const sourceUrl = job.applicationLink ?? ''
    const company = job.companyName ?? ''

    return {
      title: job.title,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: job.description || null,
      jobDescriptionPlain: stripHtmlToPlain(job.description),
      postedAt: job.pubDate ? new Date(job.pubDate * 1000) : null,
      contentHash: generateContentHash(job.title, company, location, sourceUrl),
      source: 'himalayas',
      externalId: job.guid,
      metadata: {
        companySlug: job.companySlug,
        categories: job.categories ?? [],
        excerpt: job.excerpt,
        timezoneRestrictions: job.timezoneRestrictions ?? [],
      },
      salaryMin: job.minSalary ?? null,
      salaryMax: job.maxSalary ?? null,
      salaryCurrency: (job.minSalary || job.maxSalary) ? (job.currency || null) : null,
      jobType: this.mapJobType(job.employmentType),
      isRemote: true, // Himalayas is a remote-first job board
      experienceLevel: this.mapSeniority(job.seniority),
      skills: [],
      applyUrl: job.applicationLink || null,
      expiresAt: job.expiryDate ? new Date(job.expiryDate * 1000) : null,
    }
  }

  private mapJobType(
    employmentType: string
  ): 'fulltime' | 'parttime' | 'contract' | 'internship' | null {
    if (!employmentType) return null

    const normalized = employmentType.toLowerCase()
    if (normalized.includes('full')) return 'fulltime'
    if (normalized.includes('part')) return 'parttime'
    if (normalized.includes('contract') || normalized.includes('freelance')) return 'contract'
    if (normalized.includes('intern')) return 'internship'
    return null
  }

  private mapSeniority(
    seniority: string[]
  ): 'entry' | 'mid' | 'senior' | 'lead' | null {
    if (!seniority || seniority.length === 0) return null

    const first = seniority[0].toLowerCase()
    if (first.includes('entry') || first.includes('junior')) return 'entry'
    if (first.includes('mid')) return 'mid'
    if (first.includes('senior')) return 'senior'
    if (first.includes('lead') || first.includes('manager') || first.includes('director')) return 'lead'
    return null
  }
}
