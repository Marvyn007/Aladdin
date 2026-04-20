import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { stripe } from '@/lib/stripe';
import { resolveCheckoutPriceId } from '@/lib/stripe/checkout-price';

function getSafePath(path: string | undefined, fallback: string) {
  if (!path || typeof path !== 'string') return fallback;
  return path.startsWith('/') ? path : fallback;
}

/** return_url must contain this template for embedded Checkout (Stripe replaces it). */
const SESSION_TEMPLATE = '{CHECKOUT_SESSION_ID}';

function ensureEmbeddedReturnPath(path: string): string {
  const safe = getSafePath(path, `/upgrade?session_id=${SESSION_TEMPLATE}`);
  if (safe.includes(SESSION_TEMPLATE)) return safe;
  const joiner = safe.includes('?') ? '&' : '?';
  return `${safe}${joiner}session_id=${SESSION_TEMPLATE}`;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    priceId?: string;
    plan?: string;
    successPath?: string;
    cancelPath?: string;
    returnPath?: string;
    /** `embedded_page` = co-branded in-app checkout; `hosted_page` = redirect to Stripe. */
    uiMode?: 'embedded_page' | 'hosted_page';
  };

  const resolved = resolveCheckoutPriceId({ plan: body.plan, priceId: body.priceId });
  if ('error' in resolved) {
    return NextResponse.json({ error: resolved.error }, { status: 400 });
  }
  const { priceId } = resolved;

  const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const uiMode: 'embedded_page' | 'hosted_page' = body.uiMode === 'embedded_page' ? 'embedded_page' : 'hosted_page';

  const safeSuccessPath = getSafePath(body.successPath, '/');
  const safeCancelPath = getSafePath(body.cancelPath, '/');
  const embeddedReturn = ensureEmbeddedReturnPath(body.returnPath ?? '');

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

  const base = {
    customer: stripeCustomerId,
    mode: 'subscription' as const,
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: { userId },
  };

  if (uiMode === 'embedded_page') {
    const session = await stripe.checkout.sessions.create({
      ...base,
      ui_mode: 'embedded_page',
      return_url: `${origin}${embeddedReturn}`,
    });

    if (!session.client_secret) {
      return NextResponse.json({ error: 'Checkout session missing client secret' }, { status: 500 });
    }

    return NextResponse.json({ clientSecret: session.client_secret });
  }

  const session = await stripe.checkout.sessions.create({
    ...base,
    ui_mode: 'hosted_page',
    success_url: `${origin}${safeSuccessPath}`,
    cancel_url: `${origin}${safeCancelPath}`,
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Checkout session missing URL' }, { status: 500 });
  }

  return NextResponse.json({ url: session.url });
}
