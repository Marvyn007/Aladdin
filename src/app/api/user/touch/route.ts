import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }

  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)

  const result = await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { lastActiveAt: null },
        { lastActiveAt: { lt: fiveMinutesAgo } },
      ],
    },
    data: { lastActiveAt: new Date() },
  })

  if (result.count === 0) {
    // Either user doesn't exist yet (signup race) or was updated within the last 5 minutes (debounced)
    return NextResponse.json({ ok: true, updated: false })
  }

  console.log(`[touch] Updated lastActiveAt for user ${userId}`)
  return NextResponse.json({ ok: true, updated: true })
}
