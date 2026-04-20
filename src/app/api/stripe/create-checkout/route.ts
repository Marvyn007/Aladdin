import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { resolveCheckoutPriceId } from '@/lib/stripe/checkout-price';

function getSafePath(path: string | undefined, fallback: string) {
  if (!path || typeof path !== 'string') return fallback;
  return path.startsWith('/') ? path : fallback;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    priceId?: string;
    plan?: string;
    successPath?: string;
    cancelPath?: string;
  };

  const resolved = resolveCheckoutPriceId({ plan: body.plan, priceId: body.priceId });
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { priceId } = resolved;

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const safeSuccessPath = getSafePath(body.successPath, '/');
  const safeCancelPath = getSafePath(body.cancelPath, '/');

  const sub = await prisma.subscription.findUnique({ where: { userId } });

  let stripeCustomerId = sub?.stripeCustomerId ?? undefined;

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({ metadata: { userId } });
    stripeCustomerId = customer.id;
    await prisma.subscription.upsert({
      where: { userId },
      create: { userId, stripeCustomerId, planType: 'LITE', status: 'active' },
      update: { stripeCustomerId },
    });
  }

  const session = await stripe.checkout.sessions.create({
    customer: stripeCustomerId,
    mode: 'subscription',
    ui_mode: 'hosted_page',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin}${safeSuccessPath}`,
    cancel_url: `${origin}${safeCancelPath}`,
    metadata: { userId },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout session missing URL' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
