// ── Job Source Adapter Types ──
// Spec: Section 2 — Source Adapters
//
// NOTE: Legacy types (JobSourceConfig, JobFilter, ScrapedJob, JobSourceAdapter,
// BaseJobSource) previously lived here. They are preserved in the old adapter
// files until Phase 6 cleanup. New code should use the types below.

// ── Source Adapter Interface ──

export type SourceType = 'greenhouse' | 'lever' | 'themuse' | 'arbeitnow' | 'himalayas' | 'workday' | 'imported'

export type PollTarget =
  | { type: 'company'; slug: string }
  | { type: 'bulk'; page?: number }

export interface SourceHealth {
  source: SourceType
  healthy: boolean
  latencyMs: number | null
  lastError: string | null
  checkedAt: Date
}

export interface SourceAdapter {
  name: SourceType
  poll(target: PollTarget): Promise<NormalizedJob[]>
  healthCheck(): Promise<SourceHealth>
}

// ── NormalizedJob ──
// The canonical shape every adapter must produce.

export interface NormalizedJob {
  title: string
  company: string
  location: string
  sourceUrl: string
  rawDescriptionHtml: string | null
  jobDescriptionPlain: string | null
  postedAt: Date | null
  contentHash: string
  source: SourceType
  externalId: string
  metadata: Record<string, unknown>
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  jobType: 'fulltime' | 'parttime' | 'contract' | 'internship' | null
  isRemote: boolean
  experienceLevel: 'entry' | 'mid' | 'senior' | 'lead' | null
  skills: string[]
  applyUrl: string | null
  expiresAt: Date | null
}

// ── Polling Schedule Config ──

export interface SourceScheduleConfig {
  source: SourceType
  type: 'per-company' | 'bulk'
  intervalMs: number
  priority: number
}

export const SOURCE_SCHEDULES: SourceScheduleConfig[] = [
  { source: 'greenhouse', type: 'per-company', intervalMs: 15 * 60 * 1000, priority: 1 },
  { source: 'lever', type: 'per-company', intervalMs: 15 * 60 * 1000, priority: 1 },
  { source: 'workday', type: 'per-company', intervalMs: 15 * 60 * 1000, priority: 1 },
  { source: 'themuse', type: 'bulk', intervalMs: 60 * 60 * 1000, priority: 2 },
  { source: 'arbeitnow', type: 'bulk', intervalMs: 60 * 60 * 1000, priority: 2 },
  { source: 'himalayas', type: 'bulk', intervalMs: 24 * 60 * 60 * 1000, priority: 3 },
]

export type DiscoveryTier = 1 | 2 | 3

export interface DiscoveryTierSchedule {
  tier: DiscoveryTier
  intervalMs: number
  priority: number
}

export const DISCOVERY_TIER_SCHEDULES: Record<DiscoveryTier, DiscoveryTierSchedule> = {
  1: { tier: 1, intervalMs: 2 * 60 * 60 * 1000, priority: 2 },   // 2h, P2
  2: { tier: 2, intervalMs: 6 * 60 * 60 * 1000, priority: 3 },   // 6h, P3
  3: { tier: 3, intervalMs: 12 * 60 * 60 * 1000, priority: 4 },  // 12h, P4
}

// Per-source rate limit: max 1 request per second per source (proactive)
export const RATE_LIMIT_INTERVAL_MS = 1000

