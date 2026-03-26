import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    // Get last 100 poll logs to compute per-source metrics
    const recentLogs = await prisma.sourcePollLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    })

    // Group by source
    const bySource = new Map<string, typeof recentLogs>()
    for (const log of recentLogs) {
      const existing = bySource.get(log.source) ?? []
      existing.push(log)
      bySource.set(log.source, existing)
    }

    const sources = Array.from(bySource.entries()).map(([source, logs]) => {
      const errors = logs.filter((l) => l.error !== null)
      const successful = logs.filter((l) => l.error === null)
      const avgDuration = successful.length > 0
        ? successful.reduce((sum, l) => sum + (l.durationMs ?? 0), 0) / successful.length
        : null
      const totalJobs = successful.reduce((sum, l) => sum + (l.jobsFetched ?? 0), 0)

      return {
        source,
        totalPolls: logs.length,
        successfulPolls: successful.length,
        errorCount: errors.length,
        errorRate: logs.length > 0 ? errors.length / logs.length : 0,
        avgDurationMs: avgDuration ? Math.round(avgDuration) : null,
        totalJobsFound: totalJobs,
        lastPollAt: logs[0]?.createdAt ?? null,
        lastError: errors[0]?.error ?? null,
      }
    })

    return NextResponse.json({ sources })
  } catch (err) {
    console.error('[source-health] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
