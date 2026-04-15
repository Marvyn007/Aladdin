import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { sessionId } = await params;

  const session = await prisma.autoApplySession.findFirst({
    where: { id: sessionId, userId },
    select: {
      id: true,
      status: true,
      liveViewUrl: true,
      fieldsFilledCount: true,
      pagesVisited: true,
      errorMessage: true,
      updatedAt: true,
    },
  });

  if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

  return NextResponse.json(session);
}
