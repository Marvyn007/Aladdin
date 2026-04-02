import { NextResponse } from 'next/server'

import { getAdminJobById } from '@/lib/admin/data'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const { id } = await params
    const existing = await prisma.job.findUnique({
      where: { id },
      select: { id: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const title = normalizeOptionalText(body.title)
    const company = normalizeOptionalText(body.company)
    const location = normalizeOptionalText(body.location)
    const status = normalizeOptionalText(body.status)
    const source = normalizeOptionalText(body.source)
    const sourceUrl = normalizeOptionalText(body.sourceUrl)
    const applyUrl = normalizeOptionalText(body.applyUrl)

    if (
      title === undefined &&
      company === undefined &&
      location === undefined &&
      status === undefined &&
      source === undefined &&
      sourceUrl === undefined &&
      applyUrl === undefined
    ) {
      return NextResponse.json({ error: 'No valid job fields were provided' }, { status: 400 })
    }

    await prisma.job.update({
      where: { id },
      data: {
        title: title === undefined ? undefined : title ?? 'Untitled role',
        company: company === undefined ? undefined : company,
        location: location === undefined ? undefined : location,
        status: status === undefined ? undefined : status?.toLowerCase() ?? 'fresh',
        source: source === undefined ? undefined : source?.toLowerCase() ?? 'imported',
        sourceUrl: sourceUrl === undefined ? undefined : sourceUrl ?? '',
        applyUrl: applyUrl === undefined ? undefined : applyUrl,
      },
    })

    const job = await getAdminJobById(id)
    return NextResponse.json({
      success: true,
      message: 'Job updated successfully.',
      job,
    })
  } catch (error) {
    console.error('[admin:job-update] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const { id } = await params
    const existing = await prisma.job.findUnique({
      where: { id },
      select: { id: true, title: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.searchAnalytics.updateMany({
        where: { clickedJobId: id },
        data: { clickedJobId: null },
      })

      await tx.application.deleteMany({ where: { jobId: id } })
      await tx.coverLetter.deleteMany({ where: { jobId: id } })
      await tx.userInteraction.deleteMany({ where: { jobId: id } })
      await tx.userJob.deleteMany({ where: { jobId: id } })
      await tx.tailoredResume.deleteMany({ where: { jobId: id } })
      await tx.jobScore.deleteMany({ where: { jobId: id } })
      await tx.jobVote.deleteMany({ where: { jobId: id } })
      await tx.jobGeoPoint.deleteMany({ where: { jobId: id } })
      await tx.job.delete({ where: { id } })
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${existing.title}`,
    })
  } catch (error) {
    console.error('[admin:job-delete] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
