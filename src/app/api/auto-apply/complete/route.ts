import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await request.json() as { sessionId: string };

  const session = await prisma.autoApplySession.findFirst({
    where: { id: sessionId, userId },
  });

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  await prisma.autoApplySession.update({
    where: { id: sessionId },
    data: { status: 'completed' },
  });

  return NextResponse.json({ ok: true });
}
