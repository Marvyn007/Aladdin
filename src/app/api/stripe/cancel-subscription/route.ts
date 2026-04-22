import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { getSubscriptionPeriodEnd, syncStripeSubscription } from '@/lib/stripe/subscription-sync';

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const sub = await prisma.subscription.findUnique({ where: { userId } });
  if (!sub?.stripeSubId || sub.planType === 'LITE') {
    return NextResponse.json({ error: 'No active paid subscription found' }, { status: 404 });
  }

  try {
    const stripeSub = await stripe.subscriptions.update(sub.stripeSubId, {
      cancel_at_period_end: true,
    });

    await syncStripeSubscription(stripeSub, {
      userId,
      stripeCustomerId: sub.stripeCustomerId,
    });

    return NextResponse.json({
      canceled: true,
      accessUntil: getSubscriptionPeriodEnd(stripeSub)?.toISOString() ?? null,
    });
  } catch (error) {
    console.error('[stripe/cancel-subscription] failed', error);
    return NextResponse.json({ error: 'Unable to cancel subscription' }, { status: 500 });
  }
}
