import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function POST() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const result = await prisma.jobQueue.updateMany({
      where: { status: 'dead' },
      data: {
        status: 'pending',
        attempts: 0,
        lastError: null,
        lockedAt: null,
        lockedBy: null,
      },
    })

    return NextResponse.json({ ok: true, retried: result.count })
  } catch (err) {
    console.error('[retry-dead] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
