import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain } from '../helpers'

const GREENHOUSE_API_BASE = 'https://boards-api.greenhouse.io/v1/boards'
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single job from the Greenhouse boards API */
interface GreenhouseJob {
  id: number
  title: string
  absolute_url: string
  location: { name: string }
  updated_at: string
  first_published: string | null
  internal_job_id: number
  company_name: string | null
  metadata: unknown
  requisition_id: string | null
  departments?: { id: number; name: string }[]
  content?: string
}

interface GreenhouseResponse {
  jobs: GreenhouseJob[]
  meta?: { total: number }
}

export class GreenhouseAdapter implements SourceAdapter {
  name = 'greenhouse' as const

  private lastRequestAt = 0

  /**
   * Enforce per-source rate limit: max 1 request per RATE_LIMIT_INTERVAL_MS.
   */
  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed))
    }
    this.lastRequestAt = Date.now()
  }

  async poll(target: PollTarget): Promise<NormalizedJob[]> {
    if (target.type !== 'company') {
      throw new Error('GreenhouseAdapter only supports company targets')
    }

    await this.rateLimit()

    const url = `${GREENHOUSE_API_BASE}/${target.slug}/jobs?content=true`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Greenhouse API error: ${response.status} ${response.statusText} for slug "${target.slug}"`
        )
      }

      const data = (await response.json()) as GreenhouseResponse

      if (!data.jobs || !Array.isArray(data.jobs)) {
        throw new Error(
          `Greenhouse API returned unexpected shape for slug "${target.slug}"`
        )
      }

      const normalized = data.jobs.map((job) => this.normalize(job, target.slug))
      const { isFresh } = await import('../freshness')
      return normalized.filter((job) => isFresh(job))
    } finally {
      clearTimeout(timeout)
    }
  }

  async healthCheck(): Promise<SourceHealth> {
    const start = Date.now()
    try {
      // Use a known small board for health check
      const response = await fetch(
        `${GREENHOUSE_API_BASE}/stripe/jobs`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'greenhouse',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'greenhouse',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(job: GreenhouseJob, slug: string): NormalizedJob {
    const location = job.location?.name ?? ''
    const sourceUrl = job.absolute_url
    const company = job.company_name ?? slug

    return {
      title: job.title,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: job.content || null,
      jobDescriptionPlain: job.content ? stripHtmlToPlain(job.content) : null,
      postedAt: job.first_published ? new Date(job.first_published) : (job.updated_at ? new Date(job.updated_at) : null),
      contentHash: generateContentHash(job.title, company, location, sourceUrl),
      source: 'greenhouse',
      externalId: String(job.id),
      metadata: {
        internal_job_id: job.internal_job_id,
        requisition_id: job.requisition_id,
        updated_at: job.updated_at,
        departments: job.departments ?? [],
      },
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      jobType: null,
      isRemote: this.detectRemote(location, job.title),
      experienceLevel: null,
      skills: [],
      applyUrl: sourceUrl,
      expiresAt: null,
    }
  }

  private detectRemote(location: string, title: string): boolean {
    const text = `${location} ${title}`.toLowerCase()
    return text.includes('remote') || text.includes('anywhere')
  }
}
