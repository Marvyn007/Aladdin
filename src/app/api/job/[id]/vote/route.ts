import { NextResponse } from 'next/server'
import { auth } from '@clerk/nextjs/server'
import { castVote, getJobVoteScore, getUserVote } from '@/lib/job-sources/voting-service'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { id: jobId } = await params
    const body = await request.json()
    const { value } = body

    if (value !== 1 && value !== -1) {
      return NextResponse.json(
        { error: 'Invalid vote value: must be 1 or -1' },
        { status: 400 }
      )
    }

    const result = await castVote({ userId, jobId, value })

    return NextResponse.json(result)
  } catch (err) {
    console.error('[vote] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: jobId } = await params
    const { userId } = await auth()

    const netScore = await getJobVoteScore(jobId)
    const userVote = userId ? await getUserVote(userId, jobId) : null

    return NextResponse.json({ netScore, userVote })
  } catch (err) {
    console.error('[vote:get] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
