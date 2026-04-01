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

  await prisma.user.updateMany({
    where: {
      id: userId,
      OR: [
        { lastActiveAt: null },
        { lastActiveAt: { lt: fiveMinutesAgo } },
      ],
    },
    data: { lastActiveAt: new Date() },
  })

  return NextResponse.json({ ok: true })
}
