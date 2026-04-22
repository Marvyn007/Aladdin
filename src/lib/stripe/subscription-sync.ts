import type Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { STRIPE_PRICE_TO_PLAN, PlanType } from '@/lib/subscription/tier-config';

const PAID_SUBSCRIPTION_STATUSES = new Set<Stripe.Subscription.Status>(['active', 'trialing']);

function getId(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === 'string' ? value : value.id;
}

export function getSubscriptionPeriodEnd(subscription: Stripe.Subscription): Date | null {
  const periodEnd = subscription.items.data[0]?.current_period_end;
  return periodEnd ? new Date(periodEnd * 1000) : null;
}

export function getPlanForStripeSubscription(subscription: Stripe.Subscription): PlanType {
  const price = subscription.items.data[0]?.price;
  const metadataPlan = price?.metadata?.aladdin_plan?.toUpperCase();
  if (metadataPlan === 'COPILOT' || metadataPlan === 'CAPTAIN') return metadataPlan;
  return STRIPE_PRICE_TO_PLAN[price?.id ?? ''] ?? 'LITE';
}

export function shouldGrantPaidAccess(subscription: Stripe.Subscription): boolean {
  return PAID_SUBSCRIPTION_STATUSES.has(subscription.status);
}

export async function resetUsage(userId: string) {
  await prisma.userUsage.upsert({
    where: { userId },
    create: {
      userId,
      resumesGenerated: 0,
      coverLettersGenerated: 0,
      emailsRetrieved: 0,
      linkedinRetrieved: 0,
      lastResetDate: new Date(),
    },
    update: {
      resumesGenerated: 0,
      coverLettersGenerated: 0,
      emailsRetrieved: 0,
      linkedinRetrieved: 0,
      lastResetDate: new Date(),
    },
  });
}

async function updateClerkPlan(userId: string, planType: PlanType) {
  const clerk = await clerkClient();
  await clerk.users.updateUserMetadata(userId, {
    publicMetadata: { planType },
  });
}

export async function syncStripeSubscription(
  subscription: Stripe.Subscription,
  options: {
    userId?: string | null;
    stripeCustomerId?: string | null;
    resetUsageOnPaid?: boolean;
  } = {}
) {
  const stripeCustomerId = options.stripeCustomerId ?? getId(subscription.customer);
  let userId: string | null = options.userId ?? subscription.metadata?.userId ?? null;

  if (!userId && stripeCustomerId) {
    const existing = await prisma.subscription.findFirst({
      where: {
        OR: [
          { stripeSubId: subscription.id },
          { stripeCustomerId },
        ],
      },
      select: { userId: true },
    });
    userId = existing?.userId ?? null;
  }

  if (!userId) return null;

  const priceId = subscription.items.data[0]?.price.id ?? null;
  const paidPlan = getPlanForStripeSubscription(subscription);
  const planType = shouldGrantPaidAccess(subscription) ? paidPlan : 'LITE';
  const currentPeriodEnd = getSubscriptionPeriodEnd(subscription);

  await prisma.subscription.upsert({
    where: { userId },
    create: {
      userId,
      stripeCustomerId,
      stripeSubId: subscription.id,
      stripePriceId: priceId,
      planType,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
    },
    update: {
      stripeCustomerId,
      stripeSubId: subscription.id,
      stripePriceId: priceId,
      planType,
      status: subscription.status,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      currentPeriodEnd,
    },
  });

  if (options.resetUsageOnPaid && planType !== 'LITE') {
    await resetUsage(userId);
  }

  await updateClerkPlan(userId, planType);
  return { userId, planType, status: subscription.status };
}

export async function downgradeSubscriptionToLite(
  stripeSubId: string,
  status: string,
  options: { cancelAtPeriodEnd?: boolean } = {}
) {
  const sub = await prisma.subscription.findUnique({ where: { stripeSubId } });
  if (!sub) return null;

  await prisma.subscription.update({
    where: { stripeSubId },
    data: {
      planType: 'LITE',
      status,
      cancelAtPeriodEnd: options.cancelAtPeriodEnd ?? sub.cancelAtPeriodEnd,
    },
  });

  await updateClerkPlan(sub.userId, 'LITE');
  return sub.userId;
}

export async function syncCheckoutSession(sessionId: string, expectedUserId: string) {
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  const sessionUserId = session.metadata?.userId;
  if (sessionUserId && sessionUserId !== expectedUserId) {
    throw new Error('Checkout session does not belong to this user.');
  }
  const stripeCustomerId = getId(session.customer);
  if (!sessionUserId && stripeCustomerId) {
    const existing = await prisma.subscription.findUnique({
      where: { userId: expectedUserId },
      select: { stripeCustomerId: true },
    });
    if (existing?.stripeCustomerId && existing.stripeCustomerId !== stripeCustomerId) {
      throw new Error('Checkout session does not belong to this user.');
    }
  }
  if (session.payment_status !== 'paid' || !session.subscription) {
    return { synced: false as const };
  }

  const stripeSubId = getId(session.subscription);
  if (!stripeSubId) return { synced: false as const };

  const subscription = await stripe.subscriptions.retrieve(stripeSubId);
  const synced = await syncStripeSubscription(subscription, {
    userId: expectedUserId,
    stripeCustomerId,
    resetUsageOnPaid: true,
  });

  return { synced: Boolean(synced), planType: synced?.planType ?? 'LITE' };
}
