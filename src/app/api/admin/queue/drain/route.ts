import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function POST() {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const result = await prisma.jobQueue.updateMany({
      where: { status: 'pending' },
      data: { status: 'failed', lastError: 'Drained by admin' },
    })

    return NextResponse.json({ ok: true, drained: result.count })
  } catch (err) {
    console.error('[queue-drain] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
