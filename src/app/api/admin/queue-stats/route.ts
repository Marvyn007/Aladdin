import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin/rbac'
import { getQueue } from '@/lib/queue'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const queue = getQueue()
    const stats = await queue.getStats()

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[queue-stats] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
