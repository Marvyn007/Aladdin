import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/**
 * POST (PAT auth): log a completed application from the extension.
 *
 * Request body: { jobTitle?: string, company?: string, url?: string }
 */
export async function POST(request: NextRequest) {
  const pat = await validateExtensionPat(request);
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = pat;
  const body = await request.json().catch(() => ({}));

  const url: string = body?.url ?? '';

  // Best-effort: log to Application table if a matching job exists
  if (url) {
    const job = await prisma.job.findFirst({
      where:  { OR: [{ applyUrl: url }, { sourceUrl: url }] },
      select: { id: true },
    });

    if (job) {
      const existing = await prisma.application.findFirst({
        where:  { userId, jobId: job.id },
        select: { id: true },
      });
      if (!existing) {
        await prisma.application.create({
          data: { userId, jobId: job.id, columnName: 'Applied' },
        }).catch(() => {}); // non-fatal
      }
    }
  }

  return NextResponse.json({ success: true });
}
