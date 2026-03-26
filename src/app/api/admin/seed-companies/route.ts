import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireRole } from '@/lib/admin/rbac'
import { SEED_COMPANIES } from '@/lib/job-sources/seeds'

export const dynamic = 'force-dynamic'

export async function POST() {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  try {
    const results = await prisma.$transaction(
      SEED_COMPANIES.map((company) =>
        prisma.trackedCompany.upsert({
          where: {
            slug_ats: { slug: company.slug, ats: company.ats },
          },
          create: {
            slug: company.slug,
            name: company.name,
            ats: company.ats,
            industry: company.industry,
            country: company.country,
            addedBy: 'seed',
          },
          update: {
            name: company.name,
            industry: company.industry,
            country: company.country,
          },
        })
      )
    )

    return NextResponse.json({
      ok: true,
      upserted: results.length,
    })
  } catch (err) {
    console.error('[seed-companies] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
