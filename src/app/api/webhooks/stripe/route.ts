import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import {
  downgradeSubscriptionToLite,
  resetUsage,
  syncStripeSubscription,
} from '@/lib/stripe/subscription-sync';
import type Stripe from 'stripe';

export async function POST(request: NextRequest) {
  const sig = request.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  // Idempotency: ignore already-processed events
  const existing = await prisma.webhookEvent.findUnique({ where: { id: event.id } });
  if (existing) return NextResponse.json({ received: true });
  await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      if (!userId || !session.subscription || !session.customer) break;

      const stripeSubId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription.id;
      const stripeCustomerId = typeof session.customer === 'string'
        ? session.customer
        : session.customer.id;

      const stripeSubObj = await stripe.subscriptions.retrieve(stripeSubId);
      await syncStripeSubscription(stripeSubObj, {
        userId,
        stripeCustomerId,
        resetUsageOnPaid: session.payment_status === 'paid',
      });
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      // In Stripe API 2026+, subscription is accessed via parent.subscription_details
      const parent = invoice.parent as (Stripe.Invoice.Parent & { subscription_details?: { subscription?: string | Stripe.Subscription } }) | null;
      const rawSub = parent?.subscription_details?.subscription;
      const stripeSubId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
      if (!stripeSubId) break;

      const stripeSubObj = await stripe.subscriptions.retrieve(stripeSubId);
      const synced = await syncStripeSubscription(stripeSubObj, { resetUsageOnPaid: false });
      if (!synced) break;
      const periodEnd = new Date(invoice.period_end * 1000);

      await prisma.$transaction([
        prisma.subscription.update({
          where: { stripeSubId },
          data: { currentPeriodEnd: periodEnd, status: 'active' },
        }),
      ]);
      await resetUsage(synced.userId);
      break;
    }

    case 'invoice.payment_failed':
    case 'invoice.marked_uncollectible': {
      const invoice = event.data.object as Stripe.Invoice;
      const parent = invoice.parent as (Stripe.Invoice.Parent & { subscription_details?: { subscription?: string | Stripe.Subscription } }) | null;
      const rawSub = parent?.subscription_details?.subscription;
      const stripeSubId = typeof rawSub === 'string' ? rawSub : rawSub?.id;
      if (!stripeSubId) break;

      await downgradeSubscriptionToLite(stripeSubId, invoice.status ?? 'payment_failed');
      break;
    }

    case 'customer.subscription.updated': {
      const stripeSubObj = event.data.object as Stripe.Subscription;
      await syncStripeSubscription(stripeSubObj);
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSubObj = event.data.object as Stripe.Subscription;
      await downgradeSubscriptionToLite(stripeSubObj.id, 'canceled', {
        cancelAtPeriodEnd: stripeSubObj.cancel_at_period_end,
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
