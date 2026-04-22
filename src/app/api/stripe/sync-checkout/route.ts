import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { syncCheckoutSession } from '@/lib/stripe/subscription-sync';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as { sessionId?: string };
  if (!body.sessionId) {
    return NextResponse.json({ error: 'Missing checkout session ID' }, { status: 400 });
  }

  try {
    const result = await syncCheckoutSession(body.sessionId, userId);
    return NextResponse.json(result);
  } catch (error) {
    console.error('[stripe/sync-checkout] failed', error);
    return NextResponse.json({ error: 'Unable to sync checkout session' }, { status: 500 });
  }
}
