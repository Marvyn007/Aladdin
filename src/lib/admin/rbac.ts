import { auth, clerkClient, currentUser } from '@clerk/nextjs/server'

export type AdminRole = 'admin' | 'moderator' | 'user'

const ROLE_LEVEL: Record<AdminRole, number> = {
  admin: 3,
  moderator: 2,
  user: 1,
}

interface RbacSuccess {
  userId: string
  role: AdminRole
  error?: undefined
}

interface RbacError {
  userId?: undefined
  role?: undefined
  error: {
    status: 401 | 403
    body: { error: string; required?: string }
  }
}

export type RbacResult = RbacSuccess | RbacError

function getPathValue(source: unknown, path: string): unknown {
  const segments = path.split('.')
  let current: unknown = source

  for (const segment of segments) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) {
      return undefined
    }

    current = (current as Record<string, unknown>)[segment]
  }

  return current
}

function normalizeRole(value: unknown): AdminRole | null {
  if (typeof value !== 'string') return null

  const normalized = value.trim().toLowerCase()
  if (normalized === 'admin' || normalized === 'moderator' || normalized === 'user') {
    return normalized
  }

  return null
}

function extractRoleFromClaims(sessionClaims: unknown): AdminRole | null {
  const candidates = [
    'publicMetadata.role',
    'public_metadata.role',
    'metadata.role',
    'role',
  ]

  for (const path of candidates) {
    const role = normalizeRole(getPathValue(sessionClaims, path))
    if (role) return role
  }

  return null
}

function parseEnvList(value: string | undefined): string[] {
  return value
    ?.split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean) ?? []
}

/**
 * Check authentication and role-based access.
 * Extracts role from Clerk's publicMetadata.role.
 *
 * @param minimumRole - The minimum role required for this action
 * @returns userId + role on success, or an error object to return as NextResponse
 */
export async function requireRole(minimumRole: AdminRole): Promise<RbacResult> {
  let userId: string | null = null
  let sessionClaims: unknown

  try {
    const session = await auth()
    userId = session.userId
    sessionClaims = session.sessionClaims
  } catch {
    return {
      error: {
        status: 401,
        body: { error: 'Unauthorized' },
      },
    }
  }

  if (!userId) {
    return {
      error: {
        status: 401,
        body: { error: 'Unauthorized' },
      },
    }
  }

  let role = extractRoleFromClaims(sessionClaims)
  let emailAddress: string | null = null

  if (!role) {
    try {
      const user = await currentUser()
      role = normalizeRole(user?.publicMetadata?.role)
      emailAddress = user?.primaryEmailAddress?.emailAddress ?? null
    } catch {
      // Ignore and continue to the next fallback
    }
  }

  if (!role && process.env.CLERK_SECRET_KEY?.trim()) {
    try {
      const client = await clerkClient()
      const user = await client.users.getUser(userId)
      role = normalizeRole(user.publicMetadata?.role)
      emailAddress = emailAddress ?? user.primaryEmailAddress?.emailAddress ?? null
    } catch {
      // Ignore and continue to the env allowlist fallback
    }
  }

  const adminUserIds = parseEnvList(process.env.ADMIN_USER_IDS)
  const adminEmails = parseEnvList(process.env.ADMIN_EMAILS)

  if (!role && adminUserIds.includes(userId.toLowerCase())) {
    role = 'admin'
  }

  if (!role && emailAddress && adminEmails.includes(emailAddress.toLowerCase())) {
    role = 'admin'
  }

  role ??= 'user'

  if (ROLE_LEVEL[role] < ROLE_LEVEL[minimumRole]) {
    return {
      error: {
        status: 403,
        body: { error: 'Forbidden', required: minimumRole },
      },
    }
  }

  return { userId, role }
}
