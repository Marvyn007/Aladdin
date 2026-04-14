import { NextResponse } from 'next/server'
import { getQueue } from '@/lib/queue'
import { handleScoreRefresh } from '@/lib/job-sources/scoring-worker'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  return handler(request)
}

export async function POST(request: Request) {
  return handler(request)
}

async function handler(request: Request) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const queue = getQueue()
    await handleScoreRefresh(queue)
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[/api/cron/score-refresh]', err)
    return NextResponse.json({ error: 'Score refresh failed' }, { status: 500 })
  }
}

function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET || ''
  if (!secret) return false
  if (request.headers.get('authorization') === `Bearer ${secret}`) return true
  if (request.headers.get('x-vercel-cron') === '1') return true
  return false
}
