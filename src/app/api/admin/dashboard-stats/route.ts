import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin/rbac'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    const [totalUsers, newThisWeek, dormantCount, allUsersForCharts] = await Promise.all([
      prisma.user.count(),

      prisma.user.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),

      prisma.user.count({
        where: {
          OR: [
            { lastActiveAt: { lt: fourteenDaysAgo } },
            {
              lastActiveAt: null,
              createdAt: { lt: fourteenDaysAgo },
            },
          ],
        },
      }),

      prisma.user.findMany({
        where: { createdAt: { gte: ninetyDaysAgo } },
        select: { createdAt: true },
      }),
    ])

    // Aggregate daily signups (last 90 days)
    const dailyMap: Record<string, number> = {}
    for (const user of allUsersForCharts) {
      if (!user.createdAt) continue
      const date = user.createdAt.toISOString().slice(0, 10) // YYYY-MM-DD
      dailyMap[date] = (dailyMap[date] ?? 0) + 1
    }
    const dailySignups: { date: string; count: number }[] = []
    for (let i = 89; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
      const key = d.toISOString().slice(0, 10)
      dailySignups.push({ date: key, count: dailyMap[key] ?? 0 })
    }

    // Aggregate weekly signups (last 9 weeks)
    const weeklyMap: Record<string, number> = {}
    for (const user of allUsersForCharts) {
      if (!user.createdAt) continue
      const weekStart = getWeekStart(user.createdAt)
      const key = formatWeekLabel(weekStart)
      weeklyMap[key] = (weeklyMap[key] ?? 0) + 1
    }
    const weeklySignups: { week: string; count: number }[] = []
    for (let i = 8; i >= 0; i--) {
      const weekStart = getWeekStart(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000))
      const key = formatWeekLabel(weekStart)
      weeklySignups.push({ week: key, count: weeklyMap[key] ?? 0 })
    }

    return NextResponse.json({
      totalUsers,
      newThisWeek,
      dormantCount,
      avgHealthScore: null,
      weeklySignups,
      dailySignups,
    })
  } catch (err) {
    console.error('[dashboard-stats] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

/** Returns the Monday (week start) for a given date */
function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getUTCDay() // 0 = Sunday
  const diff = (day === 0 ? -6 : 1 - day) // adjust to Monday
  d.setUTCDate(d.getUTCDate() + diff)
  d.setUTCHours(0, 0, 0, 0)
  return d
}

/** Formats a date as "Apr 1" using UTC month/day — reliable on all server environments */
function formatWeekLabel(date: Date): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}`
}
