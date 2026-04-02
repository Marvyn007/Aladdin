import { NextResponse } from 'next/server'

import { getAdminInterviews } from '@/lib/admin/data'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const interviews = await getAdminInterviews()
    return NextResponse.json({ interviews })
  } catch (error) {
    console.error('[admin:interviews] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
