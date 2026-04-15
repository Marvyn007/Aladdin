import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { jobId } = body as { jobId: string };

  if (!jobId) {
    return NextResponse.json({ error: 'jobId is required' }, { status: 400 });
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 });

  if (!job.applyUrl && !job.sourceUrl) {
    return NextResponse.json({ error: 'This job has no apply URL' }, { status: 422 });
  }

  const session = await prisma.autoApplySession.create({
    data: { userId, jobId, status: 'queued' },
  });

  await inngest.send({
    name: 'autoapply/session.start',
    data: { sessionId: session.id, userId, jobId },
  });

  return NextResponse.json({ sessionId: session.id });
}
