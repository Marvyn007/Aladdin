import { NextResponse } from 'next/server'

import { getAdminUsers } from '@/lib/admin/data'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const users = await getAdminUsers()
    return NextResponse.json({ users })
  } catch (error) {
    console.error('[admin:users] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
