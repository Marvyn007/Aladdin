import { NextResponse } from 'next/server'

import { getAdminJobs } from '@/lib/admin/data'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const jobs = await getAdminJobs()
    return NextResponse.json({ jobs })
  } catch (error) {
    console.error('[admin:jobs] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
