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
    const profile = await prisma.linkedInProfile.findUnique({
      where: { id },
      select: {
        id: true,
        filename: true,
        fileData: true,
        s3Key: true,
      },
    })

    if (!profile) {
      return NextResponse.json({ error: 'LinkedIn profile not found' }, { status: 404 })
    }

    if (profile.fileData) {
      return new NextResponse(new Uint8Array(profile.fileData), {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `inline; filename="${profile.filename || 'linkedin-profile.pdf'}"`,
        },
      })
    }

    if (!profile.s3Key) {
      return NextResponse.json({ error: 'LinkedIn profile file is missing from storage' }, { status: 404 })
    }

    const url = await getSignedDownloadUrl(profile.s3Key)
    return NextResponse.redirect(url)
  } catch (error) {
    console.error('[admin:linkedin-preview] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
