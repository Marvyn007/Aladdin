import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/admin/rbac';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('moderator');
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status });
  }

  try {
    const { id } = await params;

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company record not found' }, { status: 404 });
    }

    // Also get the job count for the detail view
    const jobCount = await prisma.job.count({
      where: { company: company.name },
    });

    return NextResponse.json({
      company: {
        ...company,
        jobCount,
      },
    });
  } catch (error) {
    console.error('[API Admin Branding Company Detail] Fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch company details' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('admin');
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    const { name, domain, logoUrl } = body;

    // Optional validation
    if (name === '') {
      return NextResponse.json({ error: 'Company name cannot be empty' }, { status: 400 });
    }

    const updated = await prisma.company.update({
      where: { id },
      data: {
        name,
        domain: domain ?? null,
        logoUrl: logoUrl ?? null,
        // Mark fetched as true to lock this record from automated ingestion overwrites
        logoFetched: true,
      },
    });

    return NextResponse.json({ company: updated });
  } catch (error) {
    console.error('[API Admin Branding Company Update] Error:', error);
    return NextResponse.json(
      { error: 'Failed to update company record' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const rbac = await requireRole('admin');
  if (rbac.error) {
    return NextResponse.json(rbac.error.body, { status: rbac.error.status });
  }

  try {
    const { id } = await params;

    await prisma.company.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API Admin Branding Company Delete] Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete company record' },
      { status: 500 }
    );
  }
}
