import { auth } from '@clerk/nextjs/server'

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

/**
 * Check authentication and role-based access.
 * Extracts role from Clerk's publicMetadata.role.
 *
 * @param minimumRole - The minimum role required for this action
 * @returns userId + role on success, or an error object to return as NextResponse
 */
export async function requireRole(minimumRole: AdminRole): Promise<RbacResult> {
  let userId: string | null = null
  let publicMetadata: Record<string, unknown> | undefined

  try {
    const session = await auth()
    userId = session.userId
    publicMetadata = (session.sessionClaims as any)?.publicMetadata
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

  const rawRole = publicMetadata?.role
  const role: AdminRole =
    typeof rawRole === 'string' && rawRole in ROLE_LEVEL
      ? (rawRole as AdminRole)
      : 'user'

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
