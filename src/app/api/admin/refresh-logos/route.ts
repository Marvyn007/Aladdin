import { NextRequest, NextResponse } from 'next/server'
import { requireRole } from '@/lib/admin/rbac'
import { prisma } from '@/lib/prisma'
import { scrapeLogoFromProviderPage } from '@/lib/company'
import { getCompanyLogo } from '@/lib/logo-dev'

export const dynamic = 'force-dynamic'
// Allow up to 5 minutes — scraping hundreds of job pages takes time
export const maxDuration = 300

/**
 * POST /api/admin/refresh-logos
 *
 * Refreshes company logos for every company that has a job in the DB.
 * For each company:
 *   1. Find a recent job with a sourceUrl
 *   2. Scrape the logo directly from the provider job listing page
 *      (Greenhouse CDN img, Lever main-header-logo, og:image on others)
 *   3. Fall back to logo.dev only if scraping returns nothing
 *
 * Body (optional):
 *   { companies: string[] }  — specific company names; omit to refresh ALL
 *   { all: true }            — explicitly refresh every company in the DB
 *
 * Query params:
 *   ?offset=0&limit=200      — pagination for large runs
 */
export async function POST(req: NextRequest) {
  const rbac = await requireRole('admin')
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status })
  }

  const { searchParams } = new URL(req.url)
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get('limit') ?? '200', 10)))

  let targetCompanies: string[] | null = null
  let refreshAll = false
  try {
    const body = await req.json().catch(() => ({}))
    if (Array.isArray(body.companies) && body.companies.length > 0) {
      targetCompanies = body.companies.map((n: unknown) => String(n).trim()).filter(Boolean)
    }
    if (body.all === true) refreshAll = true
  } catch {
    // no body
  }

  try {
    let companyNames: string[]

    if (targetCompanies) {
      companyNames = targetCompanies
    } else {
      // Pull every distinct company name that has at least one job in the DB
      const rows = await prisma.job.groupBy({
        by: ['company'],
        where: { company: { not: null } },
        orderBy: { company: 'asc' },
        skip: offset,
        take: limit,
      })
      companyNames = rows.map((r) => r.company).filter((n): n is string => Boolean(n))
    }

    const results: {
      company: string
      before: string | null
      after: string | null
      method: string
    }[] = []

    for (const name of companyNames) {
      // Current logo in DB (may be null)
      const existing = await prisma.company.findUnique({
        where: { name },
        select: { logoUrl: true },
      })
      const currentLogo = existing?.logoUrl ?? null

      // Find the most recent job for this company that has a sourceUrl
      const job = await prisma.job.findFirst({
        where: { company: name, sourceUrl: { not: '' } },
        orderBy: { postedAt: 'desc' },
        select: { sourceUrl: true, source: true },
      })

      let newLogoUrl: string | null = null
      let method = 'none'

      // 1. Try scraping the logo from the provider job listing page
      if (job?.sourceUrl && job.source) {
        const providerLogo = await scrapeLogoFromProviderPage(job.sourceUrl, job.source)
        if (providerLogo?.logoUrl) {
          newLogoUrl = providerLogo.logoUrl
          method = `provider:${job.source}`
        }
      }

      // 2. Fall back to logo.dev
      if (!newLogoUrl) {
        const result = await getCompanyLogo(name)
        if (result.logoUrl) {
          newLogoUrl = result.logoUrl
          method = 'logo.dev'
        }
      }

      // Persist if we got a logo (even if same, force-write to mark as fetched)
      if (newLogoUrl) {
        await prisma.company.upsert({
          where: { name },
          create: {
            name,
            logoUrl: newLogoUrl,
            logoFetched: true,
          },
          update: {
            logoUrl: newLogoUrl,
            logoFetched: true,
            updatedAt: new Date(),
          },
        })
        await prisma.trackedCompany.updateMany({
          where: { name },
          data: { logoUrl: newLogoUrl },
        })
      }

      results.push({ company: name, before: currentLogo, after: newLogoUrl, method })
    }

    const updated = results.filter((r) => r.after && r.after !== r.before).length
    const scraped = results.filter((r) => r.method.startsWith('provider:')).length

    return NextResponse.json({
      processed: results.length,
      updated,
      scraped,
      logoDevFallbacks: results.filter((r) => r.method === 'logo.dev').length,
      notFound: results.filter((r) => r.method === 'none').length,
      results,
    })
  } catch (err) {
    console.error('[admin/refresh-logos] Error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    )
  }
}
