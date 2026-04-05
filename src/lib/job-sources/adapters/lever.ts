import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain, detectReposted } from '../helpers'

const LEVER_API_BASE = 'https://api.lever.co/v0/postings'
const FETCH_TIMEOUT_MS = 8000

/** Shape of a single posting from the Lever API */
interface LeverPosting {
  id: string
  text: string
  hostedUrl: string
  applyUrl: string
  createdAt: number
  description: string
  descriptionPlain: string
  additional: string
  additionalPlain: string
  lists: { text: string; content: string }[]
  categories: {
    commitment: string
    department: string
    location: string
    team: string
    allLocations?: string[]
  }
  workplaceType?: string
}

export class LeverAdapter implements SourceAdapter {
  name = 'lever' as const

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
      throw new Error('LeverAdapter only supports company targets')
    }

    await this.rateLimit()

    const url = `${LEVER_API_BASE}/${target.slug}?mode=json`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(url, { signal: controller.signal })

      if (!response.ok) {
        throw new Error(
          `Lever API error: ${response.status} ${response.statusText} for slug "${target.slug}"`
        )
      }

      const data = await response.json()

      if (!Array.isArray(data)) {
        throw new Error(
          `Lever API returned unexpected shape for slug "${target.slug}"`
        )
      }

      const normalized = (data as LeverPosting[]).map((posting) =>
        this.normalize(posting, target.slug)
      )
      const { isFresh } = await import('../freshness')
      return normalized.filter((job) => isFresh(job))
    } finally {
      clearTimeout(timeout)
    }
  }

  async healthCheck(): Promise<SourceHealth> {
    const start = Date.now()
    try {
      const response = await fetch(
        `${LEVER_API_BASE}/spotify?mode=json`,
        { signal: AbortSignal.timeout(5000) }
      )

      return {
        source: 'lever',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date(),
      }
    } catch (err) {
      return {
        source: 'lever',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date(),
      }
    }
  }

  private normalize(posting: LeverPosting, slug: string): NormalizedJob {
    const location = posting.categories?.location ?? ''
    const sourceUrl = posting.hostedUrl
    const company = slug

    // Build full description HTML from description + lists
    const listsHtml = (posting.lists || [])
      .map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`)
      .join('')
    const fullHtml = (posting.description || '') + listsHtml + (posting.additional || '')

    const salary = this.parseSalary(posting.additionalPlain)

    const isReposted = detectReposted(posting.text)

    return {
      title: posting.text,
      company,
      location,
      sourceUrl,
      rawDescriptionHtml: fullHtml || null,
      jobDescriptionPlain: fullHtml ? stripHtmlToPlain(fullHtml) : null,
      postedAt: posting.createdAt ? new Date(posting.createdAt) : null,
      contentHash: generateContentHash(posting.text, company, location, sourceUrl),
      isReposted,
      source: 'lever',
      externalId: posting.id,
      metadata: {
        department: posting.categories?.department,
        team: posting.categories?.team,
        commitment: posting.categories?.commitment,
        workplaceType: posting.workplaceType,
      },
      salaryMin: salary.min,
      salaryMax: salary.max,
      salaryCurrency: salary.currency,
      jobType: null,
      isRemote: this.detectRemote(posting),
      experienceLevel: null,
      skills: [],
      applyUrl: posting.applyUrl || null,
      expiresAt: null,
    }

  }

  private detectRemote(posting: LeverPosting): boolean {
    if (posting.workplaceType === 'remote') return true

    const allLocations = posting.categories?.allLocations ?? []
    for (const loc of allLocations) {
      if (loc.toLowerCase().includes('remote')) return true
    }

    const location = posting.categories?.location ?? ''
    return location.toLowerCase().includes('remote')
  }

  private parseSalary(additionalPlain: string): {
    min: number | null
    max: number | null
    currency: string | null
  } {
    if (!additionalPlain) return { min: null, max: null, currency: null }

    // Match patterns like "$126,163 - $157,504" or "$140,000 - $200,000"
    const match = additionalPlain.match(
      /\$([0-9,]+)\s*[-–]\s*\$([0-9,]+)/
    )

    if (!match) return { min: null, max: null, currency: null }

    const min = parseInt(match[1].replace(/,/g, ''), 10)
    const max = parseInt(match[2].replace(/,/g, ''), 10)

    if (isNaN(min) || isNaN(max)) return { min: null, max: null, currency: null }

    // Detect currency — USD by default for $ sign
    const currency = additionalPlain.includes('USD') ? 'USD' : 'USD'

    return { min, max, currency }
  }
}
