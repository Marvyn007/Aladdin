import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin/rbac'
import { backfillJobs } from '@/lib/job-sources/backfill'

export const dynamic = 'force-dynamic'

export async function POST() {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const result = await backfillJobs()
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/backfill] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
