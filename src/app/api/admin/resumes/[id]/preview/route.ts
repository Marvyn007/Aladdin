import { NextResponse } from 'next/server'

import { requireRole } from '@/lib/admin/rbac'
import { prisma } from '@/lib/prisma'
import { getSignedDownloadUrl } from '@/lib/s3'

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
        fileData: true,
        s3Key: true,
        archivedAt: true,
      },
    })

    if (!resume || resume.archivedAt) {
      return NextResponse.json({ error: 'Resume not found' }, { status: 404 })
    }

    if (resume.fileData) {
      return new NextResponse(new Uint8Array(resume.fileData), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${resume.filename || 'resume.pdf'}"`,
        },
      })
    }

    if (!resume.s3Key) {
      return NextResponse.json({ error: 'Resume file is missing from storage' }, { status: 404 })
    }

    const url = await getSignedDownloadUrl(resume.s3Key)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[admin:resume-preview] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
