import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'

export const dynamic = 'force-dynamic'

export async function GET() {
  const rbac = await requireRole('moderator')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const companies = await prisma.trackedCompany.findMany({
      orderBy: [{ isActive: 'desc' }, { lastPolledAt: 'desc' }],
    })

    return NextResponse.json({ companies })
  } catch (err) {
    console.error('[companies:list] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

const VALID_ATS = ['greenhouse', 'lever']

export async function POST(request: Request) {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const body = await request.json()
    const { slug, name, ats, industry, country, websiteUrl, logoUrl } = body

    if (!slug || !name || !ats) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, name, ats' },
        { status: 400 }
      )
    }

    if (!VALID_ATS.includes(ats)) {
      return NextResponse.json(
        { error: `Invalid ats value: "${ats}". Must be one of: ${VALID_ATS.join(', ')}` },
        { status: 400 }
      )
    }

    const company = await prisma.trackedCompany.create({
      data: {
        slug,
        name,
        ats,
        industry: industry ?? null,
        country: country ?? null,
        websiteUrl: websiteUrl ?? null,
        logoUrl: logoUrl ?? null,
        addedBy: 'admin',
      },
    })

    return NextResponse.json({ company }, { status: 201 })
  } catch (err) {
    console.error('[companies:create] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
