import { clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { getAdminUserDetail } from '@/lib/admin/data'
import { prisma } from '@/lib/prisma'
import { requireRole, type AdminRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

function normalizeOptionalText(value: unknown): string | null | undefined {
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function normalizeRole(value: unknown): AdminRole | undefined {
  if (typeof value !== 'string') return undefined

  const normalized = value.trim().toLowerCase()
  if (normalized === 'admin' || normalized === 'moderator' || normalized === 'user') {
    return normalized
  }

  return undefined
}

function isClerkNotFoundError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) return false

  const maybeErrors = (error as { errors?: Array<{ code?: string }> }).errors
  return Array.isArray(maybeErrors) && maybeErrors.some((item) => item?.code === 'resource_not_found')
}

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
    const user = await getAdminUserDetail(id)

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    return NextResponse.json({ user })
  } catch (error) {
    console.error('[admin:user-detail] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
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
    const existing = await getAdminUserDetail(id)

    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const firstName = normalizeOptionalText(body.firstName)
    const lastName = normalizeOptionalText(body.lastName)
    const displayName = normalizeOptionalText(body.name)
    const accessRole = normalizeRole(body.role)

    if (
      firstName === undefined &&
      lastName === undefined &&
      displayName === undefined &&
      accessRole === undefined
    ) {
      return NextResponse.json({ error: 'No valid user fields were provided' }, { status: 400 })
    }

    const derivedFullName = [firstName ?? existing.firstName, lastName ?? existing.lastName]
      .filter(Boolean)
      .join(' ')
      .trim()
    const fullName = displayName ?? (derivedFullName || null)

    const existingDbUser = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        imageUrl: true,
        createdAt: true,
        lastActiveAt: true,
      },
    })

    if (process.env.CLERK_SECRET_KEY?.trim()) {
      const client = await clerkClient()
      const clerkPayload: Record<string, unknown> = {}

      if (typeof firstName === 'string') clerkPayload.firstName = firstName
      if (typeof lastName === 'string') clerkPayload.lastName = lastName
      if (accessRole) clerkPayload.publicMetadata = { role: accessRole }

      if (Object.keys(clerkPayload).length) {
        try {
          await client.users.updateUser(id, clerkPayload)
        } catch (error) {
          if (!isClerkNotFoundError(error)) {
            throw error
          }
        }
      }
    } else if (accessRole) {
      return NextResponse.json(
        { error: 'CLERK_SECRET_KEY is required to update user roles' },
        { status: 500 }
      )
    }

    await prisma.user.upsert({
      where: { id },
      update: {
        firstName: firstName === undefined ? undefined : firstName,
        lastName: lastName === undefined ? undefined : lastName,
        name: fullName,
      },
      create: {
        id,
        email:
          existingDbUser?.email ??
          (existing.email === 'No email available' ? null : existing.email),
        imageUrl: existingDbUser?.imageUrl ?? existing.avatarUrl,
        createdAt: existingDbUser?.createdAt ?? (existing.joinedAt ? new Date(existing.joinedAt) : undefined),
        lastActiveAt:
          existingDbUser?.lastActiveAt ?? (existing.lastActiveAt ? new Date(existing.lastActiveAt) : undefined),
        firstName: firstName ?? existing.firstName,
        lastName: lastName ?? existing.lastName,
        name: fullName ?? existing.name,
      },
    })

    const user = await getAdminUserDetail(id)
    return NextResponse.json({
      success: true,
      message: 'User updated successfully.',
      user,
    })
  } catch (error) {
    console.error('[admin:user-update] Error:', error)
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

    if (rbac.userId === id) {
      return NextResponse.json(
        { error: 'You cannot delete the admin account currently using this session.' },
        { status: 400 }
      )
    }

    const existing = await getAdminUserDetail(id)
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await tx.searchAnalytics.updateMany({
        where: { userId: id },
        data: { userId: null },
      })

      await tx.job.updateMany({
        where: { postedByUserId: id },
        data: { postedByUserId: null },
      })

      await tx.user.deleteMany({
        where: { id },
      })
    })

    if (process.env.CLERK_SECRET_KEY?.trim()) {
      const client = await clerkClient()

      try {
        await client.users.deleteUser(id)
      } catch (error) {
        if (!isClerkNotFoundError(error)) {
          throw error
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Deleted ${existing.name}.`,
    })
  } catch (error) {
    console.error('[admin:user-delete] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
