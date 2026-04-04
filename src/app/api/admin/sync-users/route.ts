import { NextResponse } from 'next/server'

import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

function pickString(obj: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const parts = path.split('.')
    let cur: unknown = obj
    for (const part of parts) {
      if (cur === null || cur === undefined || typeof cur !== 'object') { cur = undefined; break }
      const idx = Number(part)
      if (!isNaN(idx) && Array.isArray(cur)) cur = (cur as unknown[])[idx]
      else cur = (cur as Record<string, unknown>)[part]
    }
    if (typeof cur === 'string' && cur.trim()) return cur.trim()
  }
  return null
}

// Clerk SDK v6: primaryEmailAddress may be a getter, not a plain serializable property.
// Most reliable path: find emailAddress in emailAddresses[] matching primaryEmailAddressId.
function extractEmail(user: unknown): string | null {
  if (user === null || typeof user !== 'object') return null
  const obj = user as Record<string, unknown>

  const primaryId =
    typeof obj['primaryEmailAddressId'] === 'string' ? obj['primaryEmailAddressId'] :
    typeof obj['primary_email_address_id'] === 'string' ? obj['primary_email_address_id'] :
    null

  const arr = Array.isArray(obj['emailAddresses']) ? obj['emailAddresses']
    : Array.isArray(obj['email_addresses']) ? obj['email_addresses']
    : []

  if (primaryId) {
    for (const entry of arr) {
      if (entry !== null && typeof entry === 'object') {
        const e = entry as Record<string, unknown>
        if (e['id'] === primaryId) {
          const addr = typeof e['emailAddress'] === 'string' ? e['emailAddress']
            : typeof e['email_address'] === 'string' ? e['email_address'] : null
          if (addr?.trim()) return addr.trim()
        }
      }
    }
  }

  // Fall back to first email in list
  if (arr.length > 0) {
    const first = arr[0] as Record<string, unknown>
    const addr = typeof first['emailAddress'] === 'string' ? first['emailAddress']
      : typeof first['email_address'] === 'string' ? first['email_address'] : null
    if (addr?.trim()) return addr.trim()
  }

  // Legacy flat paths
  return pickString(user, [
    'primaryEmailAddress.emailAddress',
    'primaryEmailAddress.email_address',
    'externalAccounts.0.emailAddress',
    'external_accounts.0.emailAddress',
    'email',
  ])
}

export async function POST() {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  const secretKey = process.env.CLERK_SECRET_KEY?.trim()
  if (!secretKey) {
    return NextResponse.json({ error: 'CLERK_SECRET_KEY is not configured' }, { status: 500 })
  }

  try {
    const { createClerkClient } = await import('@clerk/nextjs/server')
    const clerk = createClerkClient({ secretKey })

    const pageSize = 100
    let offset = 0
    let clerkUsersFetched = 0
    const noIdentityUsers: string[] = []

    while (true) {
      const response = await clerk.users.getUserList({ limit: pageSize, offset })
      const raw = Array.isArray(response) ? response : ((response as { data?: unknown[] }).data ?? [])
      if (!raw.length) break

      for (const user of raw) {
        const id = pickString(user, ['id'])
        if (!id) continue
        clerkUsersFetched++

        const firstName = pickString(user, ['firstName', 'first_name'])
        const lastName = pickString(user, ['lastName', 'last_name'])
        const email = extractEmail(user)
        const imageUrl = pickString(user, ['imageUrl', 'image_url', 'profileImageUrl'])
        const fullName = [firstName, lastName].filter(Boolean).join(' ') || null

        if (!firstName && !lastName && !email) {
          noIdentityUsers.push(id)
        }

        // Always overwrite from Clerk — Clerk is source of truth for identity fields
        await prisma.user.updateMany({
          where: { id },
          data: {
            ...(firstName !== null ? { firstName } : {}),
            ...(lastName !== null ? { lastName } : {}),
            ...(email !== null ? { email } : {}),
            ...(fullName !== null ? { name: fullName } : {}),
            ...(imageUrl !== null ? { imageUrl } : {}),
          },
        })
      }

      offset += raw.length
      const totalCount = (response as { totalCount?: number }).totalCount ?? offset
      if (offset >= totalCount) break
    }

    const withName = await prisma.user.count({ where: { firstName: { not: null } } })
    const withEmail = await prisma.user.count({ where: { email: { not: null } } })
    const total = await prisma.user.count()

    const message = noIdentityUsers.length > 0
      ? `Synced ${clerkUsersFetched} Clerk users. ${withName}/${total} DB users have names, ${withEmail}/${total} have emails. ${noIdentityUsers.length} Clerk account(s) have no name or email in Clerk (likely phone-only signups).`
      : `Synced ${clerkUsersFetched} Clerk users. ${withName}/${total} DB users have names, ${withEmail}/${total} have emails.`

    return NextResponse.json({
      success: true,
      clerkUsersFetched,
      dbUsersWithName: withName,
      dbUsersWithEmail: withEmail,
      dbTotal: total,
      noIdentityCount: noIdentityUsers.length,
      message,
    })
  } catch (error) {
    console.error('[admin:sync-users] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
