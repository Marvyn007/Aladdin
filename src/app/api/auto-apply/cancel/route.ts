import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await request.json() as { sessionId: string };
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 });

  const session = await prisma.autoApplySession.findFirst({
    where: { id: sessionId, userId },
    select: { id: true, status: true, browserbaseSessionId: true },
  });

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  // If the session hasn't started any external resources yet, delete it outright
  // so it doesn't appear as "queued" anywhere.
  if (session.status === 'queued' && !session.browserbaseSessionId) {
    await prisma.autoApplySession.delete({ where: { id: session.id } });
    return NextResponse.json({ ok: true, deleted: true });
  }

  // Otherwise, mark cancelled. The Inngest function checks this and aborts quickly.
  if (session.status === 'completed' || session.status === 'failed') {
    return NextResponse.json({ ok: true, cancelled: false });
  }

  await prisma.autoApplySession.update({
    where: { id: session.id },
    data: { status: 'cancelled' },
  });

  return NextResponse.json({ ok: true, cancelled: true });
}

