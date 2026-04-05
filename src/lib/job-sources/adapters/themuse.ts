import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain, detectReposted } from '../helpers'

const MUSE_API_BASE = 'https://www.themuse.com/api/public/jobs'
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single job result from The Muse API */
interface MuseJob {
  id: number
  name: string
  type: string
  publication_date: string
  short_name: string
  model_type: string
  locations: { name: string }[]
  categories: { name: string }[]
  levels: { name: string; short_name: string }[]
  tags: string[]
  refs: { landing_page: string }
  company: { id: number; short_name: string; name: string }
  contents: string
}

interface MuseResponse {
  page: number
  page_count: number
  total: number
  results: MuseJob[]
}

export class TheMuseAdapter implements SourceAdapter {
  name = 'themuse' as const

  private lastRequestAt = 0
  private apiKey: string
  private stalePagesInARow = 0

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

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

    const url = `${MUSE_API_BASE}?page=${page}&api_key=${this.apiKey}`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Muse API error: ${response.status} ${response.statusText}`
        )
      }

      const data = await response.json()

      if (!data || typeof data !== 'object' || !Array.isArray(data.results)) {
        throw new Error('Muse API returned unexpected shape')
      }

      const museData = data as MuseResponse
      const normalized = museData.results.map((job) => this.normalize(job))

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
        `${MUSE_API_BASE}?page=1&api_key=${this.apiKey}`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'themuse',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'themuse',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(job: MuseJob): NormalizedJob {
    const locations = job.locations?.map((l) => l.name) ?? []
    const location = locations.join('; ')
    const sourceUrl = job.refs?.landing_page ?? ''
    const company = job.company?.name ?? ''

    return {
      title: job.name,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: job.contents || null,
      jobDescriptionPlain: stripHtmlToPlain(job.contents),
      postedAt: job.publication_date ? new Date(job.publication_date) : null,
      contentHash: generateContentHash(job.name, company, location, sourceUrl),
      isReposted: detectReposted(job.name) || job.tags?.some(t => ['new', 'reposted', 'urgent'].includes(t.toLowerCase())) || false,
      source: 'themuse',
      externalId: String(job.id),
      metadata: {
        categories: job.categories?.map((c) => c.name) ?? [],
        levels: job.levels?.map((l) => l.short_name) ?? [],
        company_short_name: job.company?.short_name,
      },
      salaryMin: null,
      salaryMax: null,
      salaryCurrency: null,
      jobType: null,
      isRemote: this.detectRemote(locations),
      experienceLevel: this.mapLevel(job.levels),
      skills: [],
      applyUrl: sourceUrl || null,
      expiresAt: null,
    }
  }

  private detectRemote(locations: string[]): boolean {
    return locations.some((l) => l.toLowerCase().includes('remote'))
  }

  private mapLevel(
    levels: { name: string; short_name: string }[]
  ): 'entry' | 'mid' | 'senior' | 'lead' | null {
    if (!levels || levels.length === 0) return null

    const shortName = levels[0].short_name.toLowerCase()
    if (shortName === 'entry') return 'entry'
    if (shortName === 'mid') return 'mid'
    if (shortName === 'senior') return 'senior'
    if (shortName === 'lead' || shortName === 'manager') return 'lead'
    return null
  }
}
