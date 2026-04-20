import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { checkAndIncrement } from '@/lib/subscription/check-usage';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  void (await params); // contactId not needed — just track the action

  const usageGuard = await checkAndIncrement(userId, 'linkedinRetrieved');
  if (!usageGuard.allowed) {
    return NextResponse.json(
      { error: usageGuard.reason, feature: 'linkedinRetrieved', resetDate: usageGuard.resetDate },
      { status: 403 }
    );
  }

  return NextResponse.json({ allowed: true });
}
