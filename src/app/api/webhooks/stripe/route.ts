import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { STRIPE_PRICE_TO_PLAN } from '@/lib/subscription/tier-config';
import { clerkClient } from '@clerk/nextjs/server';
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

  const clerk = await clerkClient();

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

      const stripeSubObj = await stripe.subscriptions.retrieve(stripeSubId) as unknown as Stripe.Subscription;
      const priceId = stripeSubObj.items.data[0]?.price.id ?? '';
      const planType = STRIPE_PRICE_TO_PLAN[priceId] ?? 'LITE';

      await prisma.subscription.upsert({
        where: { userId },
        create: { userId, stripeCustomerId, stripeSubId, stripePriceId: priceId, planType, status: 'active' },
        update: { stripeCustomerId, stripeSubId, stripePriceId: priceId, planType, status: 'active' },
      });

      await clerk.users.updateUserMetadata(userId, {
        publicMetadata: { planType },
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

      const sub = await prisma.subscription.findUnique({ where: { stripeSubId } });
      if (!sub) break;

      // period_end is available directly on the Invoice object
      const periodEnd = new Date(invoice.period_end * 1000);

      await prisma.$transaction([
        prisma.subscription.update({
          where: { stripeSubId },
          data: { currentPeriodEnd: periodEnd, status: 'active' },
        }),
        prisma.userUsage.upsert({
          where: { userId: sub.userId },
          create: { userId: sub.userId, lastResetDate: new Date() },
          update: {
            resumesGenerated: 0,
            coverLettersGenerated: 0,
            emailsRetrieved: 0,
            linkedinRetrieved: 0,
            lastResetDate: new Date(),
          },
        }),
      ]);
      break;
    }

    case 'customer.subscription.updated': {
      const stripeSubObj = event.data.object as Stripe.Subscription;
      const sub = await prisma.subscription.findUnique({ where: { stripeSubId: stripeSubObj.id } });
      if (!sub) break;

      const priceId = stripeSubObj.items.data[0]?.price.id ?? '';
      const planType = STRIPE_PRICE_TO_PLAN[priceId] ?? 'LITE';

      await prisma.subscription.update({
        where: { stripeSubId: stripeSubObj.id },
        data: {
          stripePriceId: priceId,
          planType,
          status: stripeSubObj.status,
          cancelAtPeriodEnd: stripeSubObj.cancel_at_period_end,
        },
      });

      await clerk.users.updateUserMetadata(sub.userId, {
        publicMetadata: { planType },
      });
      break;
    }

    case 'customer.subscription.deleted': {
      const stripeSubObj = event.data.object as Stripe.Subscription;
      const sub = await prisma.subscription.findUnique({ where: { stripeSubId: stripeSubObj.id } });
      if (!sub) break;

      await prisma.subscription.update({
        where: { stripeSubId: stripeSubObj.id },
        data: { planType: 'LITE', status: 'canceled' },
      });

      await clerk.users.updateUserMetadata(sub.userId, {
        publicMetadata: { planType: 'LITE' },
      });
      break;
    }
  }

  return NextResponse.json({ received: true });
}
