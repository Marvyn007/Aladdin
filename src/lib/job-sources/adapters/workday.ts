import type { SourceAdapter, NormalizedJob, PollTarget, SourceHealth } from '../types'
import { RATE_LIMIT_INTERVAL_MS } from '../types'
import { generateContentHash, stripHtmlToPlain } from '../helpers'

const FETCH_TIMEOUT_MS = 10000

interface WorkdayJobPosting {
  title: string
  externalPath: string
  locationsText: string
  postedOn: string
  bulletinId: string
}

interface WorkdayListResponse {
  jobPostings: WorkdayJobPosting[]
}

interface WorkdayJobDetails {
  jobPostingInfo: {
    title: string
    jobDescription: string
    location: string
    timeType?: string
    jobReqId?: string
    postedOn?: string
  }
}

export class WorkdayAdapter implements SourceAdapter {
  name = 'workday' as const

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
      throw new Error('WorkdayAdapter only supports company targets')
    }

    const [domain, tenant] = target.slug.split('::')
    if (!domain || !tenant) {
      throw new Error('Workday slug must be formatted as "domain::tenant" (e.g. "nvidia.wd5.myworkdayjobs.com::NVIDIAExternalCareerSite")')
    }

    await this.rateLimit()

    const listUrl = `https://${domain}/wday/cxs/${tenant}/jobs`
    const payload = { limit: 20, offset: 0, appliedFacets: {} }

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

    try {
      const response = await fetch(listUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      })

      if (!response.ok) {
        throw new Error(`Workday API error: ${response.status} ${response.statusText} for slug "${target.slug}"`)
      }

      const data = (await response.json()) as WorkdayListResponse
      if (!data.jobPostings || !Array.isArray(data.jobPostings)) {
        throw new Error(`Workday API returned unexpected shape for slug "${target.slug}"`)
      }

      const jobs: NormalizedJob[] = []

      // Fetch full description for each job since the list doesn't provide it
      for (const posting of data.jobPostings) {
        await this.rateLimit()
        
        try {
          const detailUrl = `https://${domain}/wday/cxs/${tenant}${posting.externalPath}`
          const detailRes = await fetch(detailUrl, {
            headers: { 'Accept': 'application/json' }
          })
          
          if (!detailRes.ok) continue
          
          const detailData = (await detailRes.json()) as WorkdayJobDetails
          const info = detailData.jobPostingInfo
          if (!info || !info.jobDescription) continue

          const location = info.location || posting.locationsText || ''
          const company = domain.split('.')[0]
          
          // Formulate the human readable apply URL using standard workday patterns
          const applyUrl = `https://${domain}/en-US/${tenant}${posting.externalPath}`

          jobs.push({
            title: info.title || posting.title,
            company,
            location,
            sourceUrl: applyUrl,
            rawDescriptionHtml: info.jobDescription,
            jobDescriptionPlain: stripHtmlToPlain(info.jobDescription),
            postedAt: info.postedOn ? new Date(info.postedOn) : (posting.postedOn ? new Date(posting.postedOn) : null),
            contentHash: generateContentHash(info.title || posting.title, company, location, applyUrl),
            source: 'workday',
            externalId: posting.bulletinId || posting.externalPath,
            metadata: {
              jobReqId: info.jobReqId,
              timeType: info.timeType
            },
            salaryMin: null,
            salaryMax: null,
            salaryCurrency: null,
            jobType: info.timeType?.toLowerCase().includes('part') ? 'parttime' : 'fulltime',
            isRemote: location.toLowerCase().includes('remote'),
            experienceLevel: null,
            skills: [],
            applyUrl,
            expiresAt: null
          })
        } catch (e) {
          console.warn(`[WorkdayAdapter] Failed to fetch details for ${posting.externalPath}:`, e)
        }
      }

      return jobs
    } finally {
      clearTimeout(timeout)
    }
  }

  async healthCheck(): Promise<SourceHealth> {
    const start = Date.now()
    try {
      // Small known Workday tenant to test basic connectivity (NVIDIA)
      const testDomain = 'nvidia.wd5.myworkdayjobs.com'
      const testTenant = 'NVIDIAExternalCareerSite'
      const response = await fetch(
        `https://${testDomain}/wday/cxs/${testTenant}/jobs`,
        { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({ limit: 1 }),
          signal: AbortSignal.timeout(5000) 
        }
      )

      return {
        source: 'workday',
        healthy: response.ok,
        latencyMs: Date.now() - start,
        lastError: response.ok ? null : `HTTP ${response.status}`,
        checkedAt: new Date()
      }
    } catch (err) {
      return {
        source: 'workday',
        healthy: false,
        latencyMs: Date.now() - start,
        lastError: err instanceof Error ? err.message : String(err),
        checkedAt: new Date()
      }
    }
  }
}
