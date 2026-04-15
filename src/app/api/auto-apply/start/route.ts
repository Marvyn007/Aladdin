import { NextRequest, NextResponse, after } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { inngest } from '@/lib/inngest';
import { shouldUseInlineAutoApply } from '@/lib/auto-apply/auto-apply-mode';
import { executeAutoApplySession } from '@/lib/auto-apply/execute-session';
import { triggerAutoApplyEvent } from '@/lib/auto-apply/pusher-events';

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

  const payload = { sessionId: session.id, userId, jobId };

  if (shouldUseInlineAutoApply(process.env)) {
    after(async () => {
      try {
        await executeAutoApplySession(payload);
      } catch (err) {
        console.error('[auto-apply inline]', err);
        const reason = err instanceof Error ? err.message : String(err);
        try {
          await prisma.autoApplySession.updateMany({
            where: {
              id:     session.id,
              status: { in: ['queued', 'running', 'stalled'] },
            },
            data: { status: 'failed', errorMessage: reason },
          });
          await triggerAutoApplyEvent(session.id, 'failed', { reason });
        } catch {
          // best-effort
        }
      }
    });
  } else {
    await inngest.send({
      name: 'autoapply/session.start',
      data: payload,
    });
  }

  return NextResponse.json({ sessionId: session.id });
}
