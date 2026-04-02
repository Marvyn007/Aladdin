import { NextResponse } from 'next/server'

import { getAdminInterviewById } from '@/lib/admin/data'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  return undefined
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
    const existing = await prisma.interviewExperience.findUnique({
      where: { id },
      select: { id: true, editHistory: true },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Interview experience not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const role = normalizeOptionalText(body.role)
    const companyName = normalizeOptionalText(body.companyName)
    const location = normalizeOptionalText(body.location)
    const status = normalizeOptionalText(body.status)
    const moderationNotes = normalizeOptionalText(body.moderationNotes)
    const isFlagged = normalizeBoolean(body.isFlagged)

    if (
      role === undefined &&
      companyName === undefined &&
      location === undefined &&
      status === undefined &&
      moderationNotes === undefined &&
      isFlagged === undefined
    ) {
      return NextResponse.json({ error: 'No valid interview fields were provided' }, { status: 400 })
    }

    if (companyName) {
      const company = await prisma.company.findUnique({
        where: { name: companyName },
        select: { id: true },
      })

      if (!company) {
        return NextResponse.json(
          { error: 'The selected company does not exist in the database.' },
          { status: 400 }
        )
      }
    }

    const priorHistory = Array.isArray(existing.editHistory) ? existing.editHistory : []
    const changedFields = [
      role !== undefined ? 'role' : null,
      companyName !== undefined ? 'companyName' : null,
      location !== undefined ? 'location' : null,
      status !== undefined ? 'status' : null,
      moderationNotes !== undefined ? 'moderationNotes' : null,
      isFlagged !== undefined ? 'isFlagged' : null,
    ].filter((item): item is string => Boolean(item))

    await prisma.interviewExperience.update({
      where: { id },
      data: {
        role: role === undefined ? undefined : role ?? 'Untitled interview experience',
        companyName: companyName === undefined ? undefined : companyName ?? '',
        location: location === undefined ? undefined : location ?? '',
        status: status === undefined ? undefined : status?.toLowerCase() ?? 'published',
        moderationNotes: moderationNotes === undefined ? undefined : moderationNotes,
        isFlagged: isFlagged === undefined ? undefined : isFlagged,
        lastEditedBy: rbac.userId,
        lastEditedAt: new Date(),
        editHistory: [
          ...priorHistory,
          {
            timestamp: new Date().toISOString(),
            editorId: rbac.userId,
            changedFields,
          },
        ],
      },
    })

    const interview = await getAdminInterviewById(id)
    return NextResponse.json({
      success: true,
      message: 'Interview experience updated successfully.',
      interview,
    })
  } catch (error) {
    console.error('[admin:interview-update] Error:', error)
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
    const existing = await prisma.interviewExperience.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        companyName: true,
      },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Interview experience not found' }, { status: 404 })
    }

    await prisma.interviewExperience.delete({
      where: { id },
    })

    return NextResponse.json({
      success: true,
      message: `Deleted ${existing.role} at ${existing.companyName}`,
    })
  } catch (error) {
    console.error('[admin:interview-delete] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
