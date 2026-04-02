import { createClerkClient } from '@clerk/backend'
import { formatDistanceToNowStrict } from 'date-fns'

import { prisma } from '@/lib/prisma'
import type {
  AdminDashboardStats,
  AdminLinkedInDocumentLink,
  AdminInterviewSummary,
  AdminJobSummary,
  AdminUserActivityItem,
  AdminUserDetail,
  AdminUserActivityHeatmapCell,
  AdminUserOnboardingAnswer,
  AdminUserResumeLink,
  AdminUserSegment,
  AdminUserSummary,
} from '@/lib/admin/types'

type UnknownRecord = Record<string, unknown>

interface NormalizedClerkUser {
  id: string
  name: string | null
  email: string | null
  role: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  createdAt: string | null
  lastSignInAt: string | null
}

const calendarDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
})

const UNKNOWN_USER_LABEL = 'Unknown user'
const NO_EMAIL_LABEL = 'No email available'

function hasClerkServerAccess() {
  return Boolean(process.env.CLERK_SECRET_KEY?.trim())
}

function getAdminClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY?.trim()
  if (!secretKey) {
    throw new Error('CLERK_SECRET_KEY is not configured')
  }

  return createClerkClient({ secretKey })
}

export const ADMIN_UNAVAILABLE_FIELDS = [
  "User time spent in the app is not stored anywhere in the current schema or Clerk data.",
  "Interview experience helpful yes/no vote totals are not stored anywhere in the current schema.",
  "Interview experience report-count totals are not stored anywhere in the current schema.",
  "A true paid plan / subscription tier for users is not stored in Prisma or exposed in the current Clerk metadata used by this app.",
  "Operator notes and manual user segmentation are not stored in the current schema.",
] as const

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function getPathValue(source: unknown, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = source

  for (const segment of segments) {
    if (Array.isArray(current)) {
      const index = Number(segment)
      if (!Number.isInteger(index)) return undefined
      current = current[index]
      continue
    }

    if (!isRecord(current)) return undefined
    current = current[segment]
  }

  return current
}

function pickFirst(source: unknown, paths: string[]): unknown {
  for (const path of paths) {
    const value = getPathValue(source, path)
    if (value !== undefined && value !== null) {
      return value
    }
  }

  return undefined
}

function pickString(source: unknown, paths: string[]): string | null {
  const value = pickFirst(source, paths)
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed ? trimmed : null
  }
  return null
}

function pickNumber(source: unknown, paths: string[]): number | null {
  const value = pickFirst(source, paths)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function pickArray(source: unknown, paths: string[]): unknown[] {
  const value = pickFirst(source, paths)
  return Array.isArray(value) ? value : []
}

function normalizeDate(value: unknown): string | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString()
  }

  if (typeof value === 'number') {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  if (typeof value === 'string' && value.trim()) {
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }

  return null
}

function titleCase(value: string | null | undefined, fallback = 'Unknown'): string {
  if (!value) return fallback

  return value
    .replace(/[_-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

function isMeaningfulUserText(value: string | null | undefined): value is string {
  if (!value) return false

  const trimmed = value.trim()
  if (!trimmed) return false

  return trimmed !== UNKNOWN_USER_LABEL && trimmed !== NO_EMAIL_LABEL
}

function normalizeComparableText(value: string | null | undefined): string {
  return value?.trim().replace(/\s+/g, ' ').toLowerCase() ?? ''
}

function buildFullName(firstName: string | null | undefined, lastName: string | null | undefined): string | null {
  const combined = [firstName?.trim(), lastName?.trim()].filter(Boolean).join(' ').trim()
  return combined || null
}

function deriveNameFromFilename(filename: string | null | undefined): string | null {
  if (!filename) return null

  const baseName = filename.replace(/\.[^.]+$/, '')
  const nameSegment = baseName
    .replace(/[_-]+/g, ' ')
    .replace(/\b(resume|cover letter|frontend|front end|backend|software|engineer|developer|cv)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  const tokens = nameSegment
    .split(' ')
    .filter((token) => /^[A-Za-z]{2,}$/.test(token))
    .slice(0, 2)

  if (tokens.length < 2) return null

  return tokens.map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase()).join(' ')
}

function shouldTrustDbName(name: string | null | undefined, resumeFilename: string | null | undefined): boolean {
  if (!isMeaningfulUserText(name)) return false

  const derivedName = deriveNameFromFilename(resumeFilename)
  if (!derivedName) return true

  return normalizeComparableText(name) !== normalizeComparableText(derivedName)
}

function isClerkNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const maybeErrors = (error as { errors?: Array<{ code?: string }> }).errors
  return Array.isArray(maybeErrors) && maybeErrors.some((item) => item?.code === 'resource_not_found')
}

function formatCalendarDate(value: string | null): string {
  if (!value) return 'Not available'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not available'
  return calendarDateFormatter.format(date)
}

function formatRelativeDate(value: string | null): string {
  if (!value) return 'No activity yet'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'No activity yet'
  return formatDistanceToNowStrict(date, { addSuffix: true })
}

function getUtcDayKey(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function getWeekStart(date: Date): Date {
  const value = new Date(date)
  const day = value.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  value.setUTCDate(value.getUTCDate() + diff)
  value.setUTCHours(0, 0, 0, 0)
  return value
}

function formatWeekLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date)
}

function getDisplayName(input: {
  clerk?: NormalizedClerkUser | null
  db?: {
    name: string | null
    firstName: string | null
    lastName: string | null
    email: string | null
    resumeFilename?: string | null
  } | null
}): string {
  const clerkFullName = buildFullName(input.clerk?.firstName, input.clerk?.lastName)
  if (clerkFullName) return clerkFullName

  const dbFullName = buildFullName(input.db?.firstName, input.db?.lastName)
  if (dbFullName) return dbFullName

  if (isMeaningfulUserText(input.clerk?.name)) return input.clerk.name.trim()
  if (shouldTrustDbName(input.db?.name, input.db?.resumeFilename) && input.db?.name) {
    return input.db.name.trim()
  }

  if (isMeaningfulUserText(input.clerk?.email)) return input.clerk.email.trim()
  if (isMeaningfulUserText(input.db?.email)) return input.db.email.trim()
  return UNKNOWN_USER_LABEL
}

function deriveOnboardingStatus(input: {
  resumes: number
  onboardingStatus: string | null
  profileSetupComplete: boolean
}): string {
  if (input.resumes === 0) return 'Missing Resume'
  if (input.profileSetupComplete) return 'Complete'
  if (input.onboardingStatus === 'completed') return 'Complete'
  return 'Needs Preferences'
}

function calculateHealthScore(input: {
  onboardingStatus: string
  lastActiveAt: string | null
  applications: number
  resumes: number
  tailoredResumes: number
  coverLetters: number
  searches7d: number
  interactions7d: number
  activeDays7d: number
}): number {
  const daysSinceActive = input.lastActiveAt
    ? Math.floor((Date.now() - new Date(input.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  let score = 0

  if (input.onboardingStatus === 'Complete') score += 20
  else if (input.onboardingStatus === 'Needs Preferences') score += 10

  if (daysSinceActive <= 1) score += 22
  else if (daysSinceActive <= 3) score += 18
  else if (daysSinceActive <= 7) score += 13
  else if (daysSinceActive <= 14) score += 8
  else if (daysSinceActive <= 21) score += 4

  score += Math.min(16, input.applications * 2)
  score += Math.min(10, input.resumes * 3)
  score += Math.min(12, input.tailoredResumes * 2)
  score += Math.min(8, input.coverLetters * 2)
  score += Math.min(7, input.searches7d)
  score += Math.min(10, input.interactions7d)
  score += Math.min(10, input.activeDays7d * 2)

  return Math.max(5, Math.min(99, score))
}

function deriveSegment(input: {
  joinedAt: string | null
  lastActiveAt: string | null
  healthScore: number
  activeDays7d: number
  applications: number
}): AdminUserSegment {
  const now = Date.now()
  const joinedDaysAgo = input.joinedAt
    ? Math.floor((now - new Date(input.joinedAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999
  const activeDaysAgo = input.lastActiveAt
    ? Math.floor((now - new Date(input.lastActiveAt).getTime()) / (1000 * 60 * 60 * 24))
    : 999

  if (joinedDaysAgo <= 21 && activeDaysAgo === 999) return 'New'
  if (activeDaysAgo > 21) return 'Dormant'
  if (input.healthScore >= 75 && input.activeDays7d >= 3) return 'Power'
  if (activeDaysAgo > 7 || input.healthScore < 45) return 'At Risk'
  if (joinedDaysAgo <= 21 || input.applications <= 3) return 'New'
  return 'Power'
}

function normalizeClerkUser(source: unknown): NormalizedClerkUser | null {
  const id = pickString(source, ['id', 'userId', 'user_id'])
  if (!id) return null

  const firstName = pickString(source, [
    'firstName',
    'first_name',
    'externalAccounts.0.firstName',
    'externalAccounts.0.first_name',
    'external_accounts.0.firstName',
    'external_accounts.0.first_name',
  ])
  const lastName = pickString(source, [
    'lastName',
    'last_name',
    'externalAccounts.0.lastName',
    'externalAccounts.0.last_name',
    'external_accounts.0.lastName',
    'external_accounts.0.last_name',
  ])
  const fallbackName = pickString(source, [
    'fullName',
    'full_name',
    'name',
    'username',
    'externalAccounts.0.username',
    'external_accounts.0.username',
  ])
  const email =
    pickString(source, [
      'primaryEmailAddress.emailAddress',
      'primaryEmailAddress.email_address',
      'primary_email_address.emailAddress',
      'primary_email_address.email_address',
      'emailAddresses.0.emailAddress',
      'emailAddresses.0.email_address',
      'email_addresses.0.emailAddress',
      'email_addresses.0.email_address',
      'externalAccounts.0.emailAddress',
      'externalAccounts.0.email_address',
      'external_accounts.0.emailAddress',
      'external_accounts.0.email_address',
      'email',
    ])

  const name =
    buildFullName(firstName, lastName) ||
    fallbackName ||
    null

  return {
    id,
    name,
    email,
    role: pickString(source, ['publicMetadata.role', 'public_metadata.role', 'unsafeMetadata.role', 'unsafe_metadata.role']),
    firstName,
    lastName,
    imageUrl: pickString(source, ['imageUrl', 'image_url', 'profileImageUrl', 'profile_image_url']),
    createdAt: normalizeDate(pickFirst(source, ['createdAt', 'created_at'])),
    lastSignInAt: normalizeDate(pickFirst(source, ['lastSignInAt', 'last_sign_in_at', 'lastActiveAt', 'last_active_at'])),
  }
}

function normalizeDbUserForClerkFallback(source: {
  id: string
  email: string | null
  name: string | null
  firstName: string | null
  lastName: string | null
  imageUrl: string | null
  createdAt: Date | null
  lastActiveAt: Date | null
}): NormalizedClerkUser {
  return {
    id: source.id,
    name: getDisplayName({
      db: {
        name: source.name,
        firstName: source.firstName,
        lastName: source.lastName,
        email: source.email,
      },
    }),
    email: source.email,
    role: null,
    firstName: source.firstName,
    lastName: source.lastName,
    imageUrl: source.imageUrl,
    createdAt: source.createdAt ? source.createdAt.toISOString() : null,
    lastSignInAt: source.lastActiveAt ? source.lastActiveAt.toISOString() : null,
  }
}

async function listAllClerkUsers(): Promise<NormalizedClerkUser[]> {
  if (!hasClerkServerAccess()) {
    const fallbackUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return fallbackUsers.map((user) => normalizeDbUserForClerkFallback(user))
  }

  try {
    const client = getAdminClerkClient()
    const users: NormalizedClerkUser[] = []
    const seen = new Set<string>()
    const pageSize = 100
    let offset = 0

    while (true) {
      const response = await client.users.getUserList({ limit: pageSize, offset })
      const rawUsers = Array.isArray(response)
        ? response
        : pickArray(response, ['data', 'users', 'items'])

      const normalizedPage = rawUsers
        .map((item) => normalizeClerkUser(item))
        .filter((item): item is NormalizedClerkUser => Boolean(item))

      for (const user of normalizedPage) {
        if (!seen.has(user.id)) {
          seen.add(user.id)
          users.push(user)
        }
      }

      const totalCount =
        pickNumber(response, ['totalCount', 'total_count', 'count']) ??
        offset + normalizedPage.length

      offset += rawUsers.length

      if (!rawUsers.length || offset >= totalCount) {
        break
      }
    }

    return users
  } catch (error) {
    console.error('[admin:data] Failed to list Clerk users:', error)
    const fallbackUsers = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    return fallbackUsers.map((user) => normalizeDbUserForClerkFallback(user))
  }
}

async function getClerkUserById(id: string): Promise<NormalizedClerkUser | null> {
  if (!hasClerkServerAccess()) {
    const fallbackUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
    })

    return fallbackUser ? normalizeDbUserForClerkFallback(fallbackUser) : null
  }

  try {
    const client = getAdminClerkClient()
    const rawUser = await client.users.getUser(id)
    return normalizeClerkUser(rawUser)
  } catch (error) {
    if (!isClerkNotFoundError(error)) {
      console.error(`[admin:data] Failed to load Clerk user ${id}:`, error)
    }
    const fallbackUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
    })

    return fallbackUser ? normalizeDbUserForClerkFallback(fallbackUser) : null
  }
}

function buildCountMap<
  Row extends Record<string, unknown>,
  Key extends keyof Row,
>(rows: Row[], key: Key, countAccessor: (row: Row) => number): Map<string, number> {
  const map = new Map<string, number>()

  for (const row of rows) {
    const rawKey = row[key]
    if (typeof rawKey !== 'string' || !rawKey) continue
    map.set(rawKey, countAccessor(row))
  }

  return map
}

function buildActiveDaysMap(
  sources: Array<Array<{ userId: string; date: Date | null }>>
): Map<string, number> {
  const map = new Map<string, Set<string>>()

  for (const source of sources) {
    for (const row of source) {
      if (!row.userId || !row.date) continue
      const dayKey = getUtcDayKey(row.date)
      if (!dayKey) continue

      if (!map.has(row.userId)) {
        map.set(row.userId, new Set())
      }

      map.get(row.userId)?.add(dayKey)
    }
  }

  return new Map([...map.entries()].map(([userId, days]) => [userId, days.size]))
}

async function loadUserBaseContext() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    clerkUsers,
    dbUsers,
    applicationCounts,
    recentApplicationCounts,
    recentSearchCounts,
    recentInteractionCounts,
    applicationDays,
    searchDays,
    interactionDays,
    resumeDays,
    coverLetterDays,
    tailoredResumeDays,
    interviewDays,
  ] = await Promise.all([
    listAllClerkUsers(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
        onboardingState: {
          select: {
            status: true,
            profileSetupComplete: true,
          },
        },
        resumes: {
          where: { archivedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            filename: true,
            createdAt: true,
            isDefault: true,
          },
        },
        _count: {
          select: {
            resumes: true,
            tailoredResumes: true,
            coverLetters: true,
            interviewExperiences: true,
          },
        },
      },
    }),
    prisma.application.groupBy({
      by: ['userId'],
      where: { deleted: false },
      _count: { _all: true },
    }),
    prisma.application.groupBy({
      by: ['userId'],
      where: {
        deleted: false,
        appliedAt: { gte: sevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.searchAnalytics.groupBy({
      by: ['userId'],
      where: {
        userId: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.userInteraction.groupBy({
      by: ['userId'],
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      _count: { _all: true },
    }),
    prisma.application.findMany({
      where: {
        deleted: false,
        appliedAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        appliedAt: true,
      },
    }),
    prisma.searchAnalytics.findMany({
      where: {
        userId: { not: null },
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
    prisma.userInteraction.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
    prisma.resume.findMany({
      where: {
        archivedAt: null,
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
    prisma.coverLetter.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
    prisma.tailoredResume.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
    prisma.interviewExperience.findMany({
      where: {
        createdAt: { gte: sevenDaysAgo },
      },
      select: {
        userId: true,
        createdAt: true,
      },
    }),
  ])

  const clerkById = new Map(clerkUsers.map((user) => [user.id, user]))

  if (hasClerkServerAccess()) {
    const idsNeedingEnrichment = dbUsers
      .filter((dbUser) => {
        const clerkUser = clerkById.get(dbUser.id)
        const clerkFullName = buildFullName(clerkUser?.firstName, clerkUser?.lastName)

        return (
          !clerkUser ||
          !isMeaningfulUserText(clerkFullName ?? clerkUser.name) ||
          !isMeaningfulUserText(clerkUser.email)
        )
      })
      .map((dbUser) => dbUser.id)

    if (idsNeedingEnrichment.length) {
      const enrichedUsers = await Promise.all(idsNeedingEnrichment.map((userId) => getClerkUserById(userId)))

      for (const user of enrichedUsers) {
        if (user) {
          clerkById.set(user.id, user)
        }
      }
    }
  }

  const dbById = new Map(dbUsers.map((user) => [user.id, user]))

  const applicationCountMap = buildCountMap(applicationCounts, 'userId', (row) => row._count._all)
  const recentApplicationCountMap = buildCountMap(
    recentApplicationCounts,
    'userId',
    (row) => row._count._all
  )
  const recentSearchCountMap = buildCountMap(
    recentSearchCounts.filter(
      (row): row is typeof row & { userId: string } => typeof row.userId === 'string'
    ),
    'userId',
    (row) => row._count._all
  )
  const recentInteractionCountMap = buildCountMap(
    recentInteractionCounts,
    'userId',
    (row) => row._count._all
  )
  const activeDays7dMap = buildActiveDaysMap([
    applicationDays.map((row) => ({ userId: row.userId, date: row.appliedAt })),
    searchDays
      .filter((row): row is typeof row & { userId: string } => typeof row.userId === 'string')
      .map((row) => ({ userId: row.userId, date: row.createdAt })),
    interactionDays.map((row) => ({ userId: row.userId, date: row.createdAt })),
    resumeDays.map((row) => ({ userId: row.userId, date: row.createdAt })),
    coverLetterDays.map((row) => ({ userId: row.userId, date: row.createdAt })),
    tailoredResumeDays.map((row) => ({ userId: row.userId, date: row.createdAt })),
    interviewDays.map((row) => ({ userId: row.userId, date: row.createdAt })),
  ])

  return {
    clerkById,
    dbById,
    applicationCountMap,
    recentApplicationCountMap,
    recentSearchCountMap,
    recentInteractionCountMap,
    activeDays7dMap,
  }
}

function buildResumeLink(resume: {
  id: string
  filename: string
  createdAt: Date | null
  isDefault: boolean | null
}): AdminUserResumeLink {
  return {
    id: resume.id,
    filename: resume.filename,
    createdAt: resume.createdAt ? resume.createdAt.toISOString() : null,
    isDefault: Boolean(resume.isDefault),
    previewUrl: `/api/admin/resumes/${resume.id}/preview`,
    downloadUrl: `/api/admin/resumes/${resume.id}/download`,
  }
}

function stringifyAnswerValue(value: unknown): string {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed || 'No answer recorded'
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }

  if (Array.isArray(value)) {
    const normalized = value
      .map((item) => stringifyAnswerValue(item))
      .filter(Boolean)
      .join(', ')
    return normalized || 'No answer recorded'
  }

  if (value && typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>)
      .map((item) => stringifyAnswerValue(item))
      .filter(Boolean)

    return entries.join(', ') || 'Structured answer'
  }

  return 'No answer recorded'
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []

  return value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

function buildHeatmap(
  dates: Array<Date | null | undefined>,
  days = 84
): { cells: AdminUserActivityHeatmapCell[]; activeDays: number } {
  const countsByDay = new Map<string, number>()

  for (const value of dates) {
    const dayKey = getUtcDayKey(value)
    if (!dayKey) continue
    countsByDay.set(dayKey, (countsByDay.get(dayKey) ?? 0) + 1)
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  const cells = Array.from({ length: days }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (days - 1 - index))
    const dayKey = date.toISOString().slice(0, 10)
    const count = countsByDay.get(dayKey) ?? 0
    let intensity: 0 | 1 | 2 | 3 | 4 = 0

    if (count >= 6) intensity = 4
    else if (count >= 4) intensity = 3
    else if (count >= 2) intensity = 2
    else if (count >= 1) intensity = 1

    return {
      date: dayKey,
      count,
      intensity,
    }
  })

  return {
    cells,
    activeDays: cells.filter((cell) => cell.count > 0).length,
  }
}

function calculateStreaks(cells: AdminUserActivityHeatmapCell[]): {
  currentStreak: number
  longestStreak: number
} {
  let currentStreak = 0
  let longestStreak = 0
  let runningStreak = 0

  for (const cell of cells) {
    if (cell.count > 0) {
      runningStreak += 1
      longestStreak = Math.max(longestStreak, runningStreak)
    } else {
      runningStreak = 0
    }
  }

  for (let index = cells.length - 1; index >= 0; index -= 1) {
    if (cells[index]?.count > 0) {
      currentStreak += 1
    } else {
      break
    }
  }

  return { currentStreak, longestStreak }
}

type BaseContext = Awaited<ReturnType<typeof loadUserBaseContext>>
type BaseDbUser = BaseContext['dbById'] extends Map<string, infer T> ? T | undefined : never

function buildUserSummary(args: {
  userId: string
  clerkUser: NormalizedClerkUser | null
  dbUser: BaseDbUser
  applicationCountMap: Map<string, number>
  recentSearchCountMap: Map<string, number>
  recentInteractionCountMap: Map<string, number>
  activeDays7dMap: Map<string, number>
}): AdminUserSummary {
  const applications = args.applicationCountMap.get(args.userId) ?? 0
  const searches7d = args.recentSearchCountMap.get(args.userId) ?? 0
  const interactions7d = args.recentInteractionCountMap.get(args.userId) ?? 0
  const activeDays7d = args.activeDays7dMap.get(args.userId) ?? 0
  const resumes = args.dbUser?._count.resumes ?? 0
  const tailoredResumes = args.dbUser?._count.tailoredResumes ?? 0
  const coverLetters = args.dbUser?._count.coverLetters ?? 0
  const interviews = args.dbUser?._count.interviewExperiences ?? 0
  const joinedAt =
    args.clerkUser?.createdAt ??
    (args.dbUser?.createdAt ? args.dbUser.createdAt.toISOString() : null)
  const lastActiveAt =
    (args.dbUser?.lastActiveAt ? args.dbUser.lastActiveAt.toISOString() : null) ??
    args.clerkUser?.lastSignInAt ??
    null
  const onboardingStatus = deriveOnboardingStatus({
    resumes,
    onboardingStatus: args.dbUser?.onboardingState?.status ?? null,
    profileSetupComplete: Boolean(args.dbUser?.onboardingState?.profileSetupComplete),
  })
  const healthScore = calculateHealthScore({
    onboardingStatus,
    lastActiveAt,
    applications,
    resumes,
    tailoredResumes,
    coverLetters,
    searches7d,
    interactions7d,
    activeDays7d,
  })
  const segment = deriveSegment({
    joinedAt,
    lastActiveAt,
    healthScore,
    activeDays7d,
    applications,
  })
  const defaultResumeRecord =
    args.dbUser?.resumes.find((resume) => resume.isDefault) ??
    args.dbUser?.resumes[0] ??
    null

  return {
    id: args.userId,
    name: getDisplayName({
      clerk: args.clerkUser,
      db: args.dbUser
        ? {
            name: args.dbUser.name,
            firstName: args.dbUser.firstName,
            lastName: args.dbUser.lastName,
            email: args.dbUser.email,
            resumeFilename: args.dbUser.resumes[0]?.filename ?? null,
          }
        : null,
    }),
    email:
      (isMeaningfulUserText(args.clerkUser?.email) ? args.clerkUser.email : null) ??
      (isMeaningfulUserText(args.dbUser?.email) ? args.dbUser.email : null) ??
      NO_EMAIL_LABEL,
    accessRole: titleCase(args.clerkUser?.role, 'User'),
    avatarUrl: args.clerkUser?.imageUrl ?? args.dbUser?.imageUrl ?? null,
    joinedAt,
    joinedLabel: formatCalendarDate(joinedAt),
    lastActiveAt,
    lastActiveLabel: formatRelativeDate(lastActiveAt),
    onboardingStatus,
    segment,
    healthScore,
    dbProfileExists: Boolean(args.dbUser),
    applications,
    resumes,
    tailoredResumes,
    coverLetters,
    interviews,
    searches7d,
    interactions7d,
    activeDays7d,
    defaultResume: defaultResumeRecord ? buildResumeLink(defaultResumeRecord) : null,
  }
}

async function getUserDisplayMap(): Promise<Map<string, string>> {
  const [clerkUsers, dbUsers] = await Promise.all([
    listAllClerkUsers(),
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        resumes: {
          where: { archivedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: { filename: true },
          take: 1,
        },
      },
    }),
  ])

  const clerkById = new Map(clerkUsers.map((user) => [user.id, user]))
  const displayMap = new Map<string, string>()

  for (const dbUser of dbUsers) {
    displayMap.set(
      dbUser.id,
      getDisplayName({
        clerk: clerkById.get(dbUser.id) ?? null,
        db: {
          ...dbUser,
          resumeFilename: dbUser.resumes[0]?.filename ?? null,
        },
      })
    )
  }

  for (const clerkUser of clerkUsers) {
    if (!displayMap.has(clerkUser.id)) {
      displayMap.set(
        clerkUser.id,
        getDisplayName({
          clerk: clerkUser,
          db: null,
        })
      )
    }
  }

  return displayMap
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const clerkUsers = await listAllClerkUsers()

  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

  const [totalJobs, totalReviews, totalResumesGenerated, dormantCount] = await Promise.all([
    prisma.job.count(),
    prisma.interviewExperience.count(),
    prisma.tailoredResume.count(),
    prisma.user.count({
      where: {
        OR: [
          { lastActiveAt: { lt: fourteenDaysAgo } },
          {
            lastActiveAt: null,
            createdAt: { lt: fourteenDaysAgo },
          },
        ],
      },
    }),
  ])

  const dailyMap = new Map<string, number>()
  const weeklyMap = new Map<string, number>()

  for (const user of clerkUsers) {
    if (!user.createdAt) continue

    const createdAt = new Date(user.createdAt)
    const dayKey = getUtcDayKey(createdAt)
    if (dayKey) {
      dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1)
    }

    const weekKey = formatWeekLabel(getWeekStart(createdAt))
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + 1)
  }

  const dailySignups = Array.from({ length: 90 }, (_, index) => {
    const date = new Date(now.getTime() - (89 - index) * 24 * 60 * 60 * 1000)
    const key = date.toISOString().slice(0, 10)
    return {
      date: key,
      count: dailyMap.get(key) ?? 0,
    }
  })

  const weeklySignups = Array.from({ length: 9 }, (_, index) => {
    const weekStart = getWeekStart(new Date(now.getTime() - (8 - index) * 7 * 24 * 60 * 60 * 1000))
    const key = formatWeekLabel(weekStart)
    return {
      week: key,
      count: weeklyMap.get(key) ?? 0,
    }
  })

  return {
    totalUsers: clerkUsers.length,
    totalJobs,
    totalReviews,
    totalResumesGenerated,
    newThisWeek: clerkUsers.filter((user) => user.createdAt && new Date(user.createdAt) >= sevenDaysAgo).length,
    dormantCount,
    avgHealthScore: null,
    dailySignups,
    weeklySignups,
  }
}

export async function getAdminUsers(): Promise<AdminUserSummary[]> {
  const context = await loadUserBaseContext()
  const userIds = new Set<string>([
    ...context.clerkById.keys(),
    ...context.dbById.keys(),
  ])

  return [...userIds]
    .map((userId) =>
      buildUserSummary({
        userId,
        clerkUser: context.clerkById.get(userId) ?? null,
        dbUser: context.dbById.get(userId),
        applicationCountMap: context.applicationCountMap,
        recentSearchCountMap: context.recentSearchCountMap,
        recentInteractionCountMap: context.recentInteractionCountMap,
        activeDays7dMap: context.activeDays7dMap,
      })
    )
    .sort((left, right) => {
      const rightTime = right.joinedAt ? new Date(right.joinedAt).getTime() : 0
      const leftTime = left.joinedAt ? new Date(left.joinedAt).getTime() : 0
      return rightTime - leftTime
    })
}

export async function getAdminUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const [context, dbUserDetail, clerkUser] = await Promise.all([
    loadUserBaseContext(),
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        firstName: true,
        lastName: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
        onboardingState: {
          select: {
            status: true,
            currentStep: true,
            startedAt: true,
            completedAt: true,
            profileSetupComplete: true,
          },
        },
        onboardingAnswers: {
          orderBy: [{ stepKey: 'asc' }, { orderIndex: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            stepKey: true,
            questionLabel: true,
            answerText: true,
            answerJson: true,
            updatedAt: true,
          },
        },
        appSettings: {
          select: {
            freshLimit: true,
            excludedKeywords: true,
            lastUpdated: true,
          },
        },
        resumes: {
          where: { archivedAt: null },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
          select: {
            id: true,
            filename: true,
            createdAt: true,
            isDefault: true,
          },
        },
        linkedInProfiles: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            filename: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            resumes: true,
            tailoredResumes: true,
            coverLetters: true,
            interviewExperiences: true,
          },
        },
      },
    }),
    getClerkUserById(userId),
  ])

  const dbUser = dbUserDetail ?? context.dbById.get(userId)
  const summary =
    context.clerkById.has(userId) || context.dbById.has(userId) || clerkUser || dbUser
      ? buildUserSummary({
          userId,
          clerkUser: clerkUser ?? context.clerkById.get(userId) ?? null,
          dbUser,
          applicationCountMap: context.applicationCountMap,
          recentSearchCountMap: context.recentSearchCountMap,
          recentInteractionCountMap: context.recentInteractionCountMap,
          activeDays7dMap: context.activeDays7dMap,
        })
      : null

  if (!summary) return null

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [
    recentApplications,
    recentResumeUploads,
    recentTailoredResumes,
    recentCoverLetters,
    recentSearches,
    recentInteractions,
    recentInterviews,
    searches30d,
    interactions30d,
    coverLetters7d,
    interviews7d,
    applicationHeatmapDates,
    searchHeatmapDates,
    interactionHeatmapDates,
    resumeHeatmapDates,
    coverLetterHeatmapDates,
    tailoredResumeHeatmapDates,
    interviewHeatmapDates,
  ] = await Promise.all([
    prisma.application.findMany({
      where: { userId, deleted: false },
      orderBy: { appliedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        appliedAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
    prisma.resume.findMany({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        filename: true,
        createdAt: true,
      },
    }),
    prisma.tailoredResume.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
    prisma.coverLetter.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        createdAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
    prisma.searchAnalytics.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        queryText: true,
        resultsCount: true,
        createdAt: true,
      },
    }),
    prisma.userInteraction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        interactionType: true,
        createdAt: true,
        job: { select: { title: true, company: true } },
      },
    }),
    prisma.interviewExperience.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true,
        role: true,
        companyName: true,
        createdAt: true,
      },
    }),
    prisma.searchAnalytics.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.userInteraction.count({
      where: {
        userId,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.coverLetter.count({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.interviewExperience.count({
      where: {
        userId,
        createdAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.application.findMany({
      where: {
        userId,
        deleted: false,
        appliedAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { appliedAt: true },
    }),
    prisma.searchAnalytics.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
    prisma.userInteraction.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
    prisma.resume.findMany({
      where: {
        userId,
        archivedAt: null,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
    prisma.coverLetter.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
    prisma.tailoredResume.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
    prisma.interviewExperience.findMany({
      where: {
        userId,
        createdAt: { gte: new Date(Date.now() - 84 * 24 * 60 * 60 * 1000) },
      },
      select: { createdAt: true },
    }),
  ])

  const heatmapSourceDates = [
    ...applicationHeatmapDates.map((item) => item.appliedAt),
    ...searchHeatmapDates.map((item) => item.createdAt),
    ...interactionHeatmapDates.map((item) => item.createdAt),
    ...resumeHeatmapDates.map((item) => item.createdAt),
    ...coverLetterHeatmapDates.map((item) => item.createdAt),
    ...tailoredResumeHeatmapDates.map((item) => item.createdAt),
    ...interviewHeatmapDates.map((item) => item.createdAt),
  ]

  const activityHeatmap = buildHeatmap(heatmapSourceDates, 84)
  const streaks = calculateStreaks(activityHeatmap.cells)

  const onboardingAnswers: AdminUserOnboardingAnswer[] =
    dbUserDetail?.onboardingAnswers.map((answer) => ({
      id: answer.id,
      stepKey: answer.stepKey,
      questionLabel: answer.questionLabel,
      answer: stringifyAnswerValue(answer.answerText ?? answer.answerJson),
      updatedAt: answer.updatedAt ? answer.updatedAt.toISOString() : null,
    })) ?? []

  const linkedInProfiles: AdminLinkedInDocumentLink[] =
    dbUserDetail?.linkedInProfiles.map((profile) => ({
      id: profile.id,
      filename: profile.filename,
      createdAt: profile.createdAt ? profile.createdAt.toISOString() : null,
      previewUrl: `/api/admin/linkedin/${profile.id}/preview`,
    })) ?? []

  const recentActivity: AdminUserActivityItem[] = [
    ...recentApplications.map((item) => ({
      id: `application-${item.id}`,
      label: 'Applied to a job',
      detail: [item.job?.title, item.job?.company].filter(Boolean).join(' at ') || 'Application recorded',
      timestamp: item.appliedAt ? item.appliedAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.appliedAt ? item.appliedAt.toISOString() : null),
      type: 'application' as const,
    })),
    ...recentResumeUploads.map((item) => ({
      id: `resume-${item.id}`,
      label: 'Uploaded a resume',
      detail: item.filename,
      timestamp: item.createdAt ? item.createdAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.createdAt ? item.createdAt.toISOString() : null),
      type: 'resume' as const,
    })),
    ...recentTailoredResumes.map((item) => ({
      id: `tailored-${item.id}`,
      label: 'Generated a tailored resume',
      detail: [item.job?.title, item.job?.company].filter(Boolean).join(' at ') || 'Tailored resume created',
      timestamp: item.createdAt ? item.createdAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.createdAt ? item.createdAt.toISOString() : null),
      type: 'tailored-resume' as const,
    })),
    ...recentCoverLetters.map((item) => ({
      id: `cover-letter-${item.id}`,
      label: 'Generated a cover letter',
      detail: [item.job?.title, item.job?.company].filter(Boolean).join(' at ') || 'Cover letter created',
      timestamp: item.createdAt ? item.createdAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.createdAt ? item.createdAt.toISOString() : null),
      type: 'cover-letter' as const,
    })),
    ...recentSearches.map((item) => ({
      id: `search-${item.id}`,
      label: 'Ran a search',
      detail: item.resultsCount !== null ? `"${item.queryText}" with ${item.resultsCount} results` : `"${item.queryText}"`,
      timestamp: item.createdAt ? item.createdAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.createdAt ? item.createdAt.toISOString() : null),
      type: 'search' as const,
    })),
    ...recentInteractions.map((item) => ({
      id: `interaction-${item.id}`,
      label: `Tracked ${titleCase(item.interactionType, 'interaction')}`,
      detail: [item.job?.title, item.job?.company].filter(Boolean).join(' at ') || 'Job interaction recorded',
      timestamp: item.createdAt ? item.createdAt.toISOString() : null,
      timestampLabel: formatRelativeDate(item.createdAt ? item.createdAt.toISOString() : null),
      type: 'interaction' as const,
    })),
    ...recentInterviews.map((item) => ({
      id: `interview-${item.id}`,
      label: 'Shared an interview experience',
      detail: [item.role, item.companyName].filter(Boolean).join(' at '),
      timestamp: item.createdAt.toISOString(),
      timestampLabel: formatRelativeDate(item.createdAt.toISOString()),
      type: 'interview' as const,
    })),
  ]
    .sort((left, right) => {
      const rightTime = right.timestamp ? new Date(right.timestamp).getTime() : 0
      const leftTime = left.timestamp ? new Date(left.timestamp).getTime() : 0
      return rightTime - leftTime
    })
    .slice(0, 12)

  return {
    ...summary,
    firstName: clerkUser?.firstName ?? dbUser?.firstName ?? null,
    lastName: clerkUser?.lastName ?? dbUser?.lastName ?? null,
    lastSignInAt: clerkUser?.lastSignInAt ?? null,
    lastSignInLabel: formatRelativeDate(clerkUser?.lastSignInAt ?? null),
    onboardingCurrentStep: dbUserDetail?.onboardingState?.currentStep ?? null,
    onboardingStartedAt: dbUserDetail?.onboardingState?.startedAt ? dbUserDetail.onboardingState.startedAt.toISOString() : null,
    onboardingCompletedAt: dbUserDetail?.onboardingState?.completedAt ? dbUserDetail.onboardingState.completedAt.toISOString() : null,
    searches30d,
    interactions30d,
    applications7d: context.recentApplicationCountMap.get(userId) ?? 0,
    coverLetters7d,
    interviews7d,
    freshJobLimit: dbUserDetail?.appSettings?.freshLimit ?? null,
    excludedKeywords: normalizeStringArray(dbUserDetail?.appSettings?.excludedKeywords),
    onboardingAnswersCount: onboardingAnswers.length,
    currentStreak: streaks.currentStreak,
    longestStreak: streaks.longestStreak,
    activeDays30d: activityHeatmap.cells.slice(-30).filter((cell) => cell.count > 0).length,
    activeDays90d: activityHeatmap.activeDays,
    documentsCount: (dbUserDetail?.resumes.length ?? 0) + linkedInProfiles.length,
    activityHeatmap: activityHeatmap.cells,
    linkedInProfiles,
    onboardingAnswers,
    resumesList:
      dbUserDetail?.resumes.map((resume) => buildResumeLink(resume)) ??
      (summary.defaultResume ? [summary.defaultResume] : []),
    recentActivity,
  }
}

export async function getAdminJobs(): Promise<AdminJobSummary[]> {
  const [jobs, applicationCounts, tailoredResumeCounts, coverLetterCounts, savedCounts, displayMap] = await Promise.all([
    prisma.job.findMany({
      orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        company: true,
        location: true,
        postedAt: true,
        createdAt: true,
        datePostedDisplay: true,
        datePostedIso: true,
        source: true,
        sourceHost: true,
        sourceUrl: true,
        applyUrl: true,
        status: true,
        postedByUserId: true,
      },
    }),
    prisma.application.groupBy({
      by: ['jobId'],
      where: {
        jobId: { not: null },
        deleted: false,
      },
      _count: { _all: true },
    }),
    prisma.tailoredResume.groupBy({
      by: ['jobId'],
      _count: { _all: true },
    }),
    prisma.coverLetter.groupBy({
      by: ['jobId'],
      where: {
        jobId: { not: null },
      },
      _count: { _all: true },
    }),
    prisma.userJob.groupBy({
      by: ['jobId'],
      where: {
        status: 'saved',
      },
      _count: { _all: true },
    }),
    getUserDisplayMap(),
  ])

  const applicationCountMap = buildCountMap(
    applicationCounts.filter(
      (row): row is typeof row & { jobId: string } => typeof row.jobId === 'string'
    ),
    'jobId',
    (row) => row._count._all
  )
  const tailoredResumeCountMap = buildCountMap(tailoredResumeCounts, 'jobId', (row) => row._count._all)
  const coverLetterCountMap = buildCountMap(
    coverLetterCounts.filter(
      (row): row is typeof row & { jobId: string } => typeof row.jobId === 'string'
    ),
    'jobId',
    (row) => row._count._all
  )
  const savedCountMap = buildCountMap(savedCounts, 'jobId', (row) => row._count._all)

  return jobs.map((job) => {
    const postedAt =
      (job.postedAt ? job.postedAt.toISOString() : null) ??
      normalizeDate(job.datePostedIso) ??
      (job.createdAt ? job.createdAt.toISOString() : null)

    return {
      id: job.id,
      title: job.title,
      company: job.company ?? 'Unknown company',
      location: job.location ?? 'Location not provided',
      postedAt,
      postedLabel: job.datePostedDisplay ?? formatCalendarDate(postedAt),
      source: titleCase(job.source, 'Unknown'),
      discoveredFrom: job.sourceHost ?? job.applyUrl ?? job.sourceUrl,
      sourceUrl: job.applyUrl ?? job.sourceUrl,
      status: titleCase(job.status, 'Fresh'),
      applications: applicationCountMap.get(job.id) ?? 0,
      resumeGenerations: tailoredResumeCountMap.get(job.id) ?? 0,
      coverLetters: coverLetterCountMap.get(job.id) ?? 0,
      saves: savedCountMap.get(job.id) ?? 0,
      postedByName: job.postedByUserId ? displayMap.get(job.postedByUserId) ?? null : null,
    }
  })
}

export async function getAdminJobById(jobId: string): Promise<AdminJobSummary | null> {
  const jobs = await getAdminJobs()
  return jobs.find((job) => job.id === jobId) ?? null
}

export async function getAdminInterviews(): Promise<AdminInterviewSummary[]> {
  const [interviews, displayMap] = await Promise.all([
    prisma.interviewExperience.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        role: true,
        companyName: true,
        location: true,
        userId: true,
        createdAt: true,
        status: true,
        isFlagged: true,
        moderationNotes: true,
        lastEditedBy: true,
      },
    }),
    getUserDisplayMap(),
  ])

  return interviews.map((interview) => ({
    id: interview.id,
    title: interview.role,
    company: interview.companyName,
    location: interview.location,
    postedByName: displayMap.get(interview.userId) ?? 'Unknown user',
    postedAt: interview.createdAt.toISOString(),
    postedLabel: formatCalendarDate(interview.createdAt.toISOString()),
    helpfulYes: null,
    helpfulNo: null,
    helpfulTracked: false,
    status: titleCase(interview.status, 'Published'),
    isFlagged: interview.isFlagged,
    moderationNotes: interview.moderationNotes,
    lastEditedByName: interview.lastEditedBy ? displayMap.get(interview.lastEditedBy) ?? interview.lastEditedBy : null,
  }))
}

export async function getAdminInterviewById(interviewId: string): Promise<AdminInterviewSummary | null> {
  const interviews = await getAdminInterviews()
  return interviews.find((interview) => interview.id === interviewId) ?? null
}
