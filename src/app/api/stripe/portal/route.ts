import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';

function getSafePath(path: string | undefined, fallback: string) {
  if (!path || typeof path !== 'string') return fallback;
  return path.startsWith('/') ? path : fallback;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeCustomerId) {
    return NextResponse.json({ error: 'No active subscription found' }, { status: 404 });
  }

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const { returnPath } = await request.json().catch(() => ({})) as {
    returnPath?: string;
  };
  const safeReturnPath = getSafePath(returnPath, '/');

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${origin}${safeReturnPath}`,
  });

  return NextResponse.json({ url: session.url });
}
