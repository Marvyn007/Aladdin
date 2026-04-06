import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain, detectReposted, categorizeExperienceLevel, categorizeJobType } from '../helpers'

const ASHBY_API_BASE = 'https://api.ashbyhq.com/posting-api/job-board'
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single job from the Ashby posting API */
interface AshbyJob {
  id: string
  title: string
  location: string
  secondaryLocations: string[]
  workplaceType: string
  employmentType: string
  compensation: {
    summary: string
    compensationType: string
    interval: string
    currencyCode: string
    minValue: number | null
    maxValue: number | null
  }[]
  publishedAt: string
  descriptionHtml: string
}

interface AshbyResponse {
  apiVersion: string
  jobs: AshbyJob[]
}

export class AshbyAdapter implements SourceAdapter {
  name = 'ashby' as const

  private lastRequestAt = 0

  private async rateLimit(): Promise<void> {
    const elapsed = Date.now() - this.lastRequestAt
    if (elapsed < RATE_LIMIT_INTERVAL_MS) {
      await new Promise((r) => setTimeout(r, RATE_LIMIT_INTERVAL_MS - elapsed))
    }
    this.lastRequestAt = Date.now()
  }

  async poll(target: PollTarget): Promise<NormalizedJob[]> {
    if (target.type !== 'company') {
      throw new Error('AshbyAdapter only supports company targets')
    }

    await this.rateLimit()

    const url = `${ASHBY_API_BASE}/${target.slug}?includeCompensation=true`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Ashby API error: ${response.status} ${response.statusText} for slug "${target.slug}"`
        )
      }

      const data = (await response.json()) as AshbyResponse

      if (!data || !Array.isArray(data.jobs)) {
        throw new Error(
          `Ashby API returned unexpected shape for slug "${target.slug}"`
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
      // Use OpenAI as a known healthy Ashby board
      const response = await fetch(
        `${ASHBY_API_BASE}/openai`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'ashby',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'ashby',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(job: AshbyJob, slug: string): NormalizedJob {
    const location = job.location ?? ''
    const sourceUrl = `https://jobs.ashbyhq.com/${slug}/${job.id}`
    const company = slug

    const salary = this.parseSalary(job.compensation)

    const isReposted = detectReposted(job.title)

    return {
      title: job.title,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: job.descriptionHtml || null,
      jobDescriptionPlain: job.descriptionHtml ? stripHtmlToPlain(job.descriptionHtml) : null,
      postedAt: job.publishedAt ? new Date(job.publishedAt) : null,
      contentHash: generateContentHash(job.title, company, location, sourceUrl),
      isReposted,
      source: 'ashby',
      externalId: job.id,
      metadata: {
        secondaryLocations: job.secondaryLocations ?? [],
        workplaceType: job.workplaceType,
        employmentType: job.employmentType,
      },
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      jobType: categorizeJobType(job.title) ?? this.mapJobType(job.employmentType),
      isRemote: job.workplaceType === 'Remote' || location.toLowerCase().includes('remote'),
      experienceLevel: categorizeExperienceLevel(job.title),
      skills: [],
      applyUrl: sourceUrl, // Ashby usually uses the same page for application
      expiresAt: null,
    }
  }

  private mapJobType(
    employmentType: string
  ): 'fulltime' | 'parttime' | 'contract' | 'internship' | null {
    if (!employmentType) return null
    const normalized = employmentType.toLowerCase()
    if (normalized.includes('full')) return 'fulltime'
    if (normalized.includes('part')) return 'parttime'
    if (normalized.includes('contract')) return 'contract'
    if (normalized.includes('intern')) return 'internship'
    return null
  }

  private parseSalary(compensation: AshbyJob['compensation']): {
    min: number | null
    max: number | null
    currency: string | null
  } {
    if (!compensation || compensation.length === 0) {
      return { min: null, max: null, currency: null }
    }

    // Usually salary is the first entry
    const salary = compensation.find((c) => c.compensationType === 'Salary')
    if (!salary) return { min: null, max: null, currency: null }

    return {
      min: salary.minValue,
      max: salary.maxValue,
      currency: salary.currencyCode,
    }
  }
}
