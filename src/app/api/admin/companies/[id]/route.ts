import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

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

    const existing = await prisma.trackedCompany.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    const body = await request.json()
    const allowedFields = ['name', 'isActive', 'industry', 'country', 'websiteUrl', 'logoUrl']
    const data: Record<string, unknown> = {}

    for (const field of allowedFields) {
      if (field in body) {
        data[field] = body[field]
      }
    }

    const company = await prisma.trackedCompany.update({
      where: { id },
      data,
    })

    return NextResponse.json({ company })
  } catch (err) {
    console.error('[companies:update] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
