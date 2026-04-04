import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/admin/rbac';

export const dynamic = 'force-dynamic';

export async function GET() {
  const rbac = await requireRole('moderator');
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status });
  }

  try {
    // 1. Fetch all companies for branding
    const companies = await prisma.company.findMany({
      orderBy: { name: 'asc' },
    });

    // 2. Fetch job counts grouped by company name
    const jobCounts = await prisma.job.groupBy({
      by: ['company'],
      _count: {
        _all: true,
      },
    });

    // 3. Map counts for easy lookup
    const countMap: Record<string, number> = {};
    for (const item of jobCounts) {
      if (item.company) {
        countMap[item.company] = item._count._all;
      }
    }

    // 4. Combine data
    const enrichedCompanies = companies.map((c) => ({
      ...c,
      jobCount: countMap[c.name] || 0,
    }));

    return NextResponse.json({
      companies: enrichedCompanies,
    });
  } catch (error) {
    console.error('[API Admin Branding Companies] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const rbac = await requireRole('admin');
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status });
  }

  try {
    const body = await request.json();
    const { name, domain, logoUrl, hasPracticeQuestions } = body;

    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 });
    }

    // Check for existing company by name
    const existing = await prisma.company.findUnique({
      where: { name: name.trim() },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A company with this name already exists in the database' },
        { status: 409 }
      );
    }

    const company = await prisma.company.create({
      data: {
        name: name.trim(),
        domain: domain || null,
        logoUrl: logoUrl || null,
        hasPracticeQuestions: !!hasPracticeQuestions,
        // Mark as fetched to lock it from automated overwrites
        logoFetched: true,
      },
    });

    return NextResponse.json({ company }, { status: 201 });
  } catch (error) {
    console.error('[API Admin Branding Companies] POST error:', error);
    return NextResponse.json(
      { error: 'Failed to create company record' },
      { status: 500 }
    );
  }
}
