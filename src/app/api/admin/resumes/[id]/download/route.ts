import { NextResponse } from 'next/server'

import { getSignedDownloadUrl } from '@/lib/s3'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const { id } = await params
    const resume = await prisma.resume.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        s3Key: true,
        archivedAt: true,
      },
    })

    if (!resume || resume.archivedAt) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (!resume.s3Key) {
      return NextResponse.json({ error: 'Resume file is missing from storage' }, { status: 404 })
    }

    const url = await getSignedDownloadUrl(
      resume.s3Key,
      3600,
      resume.filename || 'resume.pdf'
    )

    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[admin:resume-download] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
