'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { ArrowLeft, Check, Shield } from 'lucide-react';
import css from '@/components/upgrade/upgrade-checkout.module.css';
import type { CheckoutPlanKey } from '@/lib/stripe/checkout-price';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PLAN_COPY: Record<
  CheckoutPlanKey,
  {
    pillLabel: string;
    headline: string;
    price: string;
    interval: string;
    tagline: string;
    bullets: string[];
  }
> = {
  copilot: {
    pillLabel: 'Co-Pilot',
    headline: 'Run your search with AI that saves real time.',
    price: '$6.99',
    interval: '/ month',
    tagline: 'Tailored resumes, sharper outreach, and tracking that keeps pace with you—not the other way around.',
    bullets: [
      'Monthly quota for AI-tailored resumes (see limits in-app)',
      'Cover letters tuned for replies, not filler',
      'LinkedIn insights for warmer intros',
      'Referral network access inside Aladdin',
      'Apply Pilot auto-fill where supported',
    ],
  },
  captain: {
    pillLabel: 'Captain',
    headline: 'Maximum reach when every application counts.',
    price: '$16.99',
    interval: '/ month',
    tagline: 'Higher caps on resumes and verified contacts, unlimited where your plan allows, and priority signal on new roles.',
    bullets: [
      'Higher monthly caps on tailored resumes and verified emails',
      'Unlimited AI cover letters where your plan allows',
      'Unlimited LinkedIn lead depth where your plan allows',
      'Priority alerts for time-sensitive opportunities',
      'Everything in Co-Pilot',
    ],
  },
};

function normalizePlan(raw: string | null): CheckoutPlanKey | null {
  const v = raw?.toLowerCase() ?? '';
  if (v === 'copilot' || v === 'pilot') return 'copilot';
  if (v === 'captain') return 'captain';
  return null;
}

export function UpgradeCheckoutClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isLoaded, isSignedIn } = useUser();
  const plan = useMemo(() => normalizePlan(searchParams.get('plan')), [searchParams]);

  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    if (!plan) {
      setError('Pick a plan from the pricing page first.');
      return;
    }
    if (!stripePromise) {
      setError('Stripe publishable key is missing (NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY).');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/stripe/create-checkout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            plan,
            uiMode: 'embedded_page',
            returnPath: `/upgrade?session_id={CHECKOUT_SESSION_ID}`,
          }),
        });
        const data = (await res.json()) as { clientSecret?: string; error?: string };
        if (!res.ok) {
          if (!cancelled) setError(data.error ?? 'Could not start checkout.');
          return;
        }
        if (!data.clientSecret) {
          if (!cancelled) setError('Checkout did not return a client secret.');
          return;
        }
        if (!cancelled) setClientSecret(data.clientSecret);
      } catch {
        if (!cancelled) setError('Network error starting checkout.');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, plan]);

  useEffect(() => {
    if (!isLoaded || isSignedIn) return;
    router.replace(`/sign-in?redirect_url=${encodeURIComponent(window.location.href)}`);
  }, [isLoaded, isSignedIn, router]);

  if (!isLoaded) {
    return (
      <div className={css.page}>
        <div className={css.loader}>
          <div className={css.spinner} />
          <span>Preparing secure checkout…</span>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className={css.page}>
        <div className={css.loader}>
          <div className={css.spinner} />
          <span>Redirecting to sign in…</span>
        </div>
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className={css.page}>
        <div className={css.inner}>
          <div className={css.errorBox}>{error ?? 'Invalid checkout link.'}</div>
          <p className={css.errorLink}>
            <Link href="/upgrade">Back to plans</Link>
          </p>
        </div>
      </div>
    );
  }

  const copy = PLAN_COPY[plan];

  return (
    <div className={css.page}>
      <div className={css.inner}>
        <div className={css.grid} data-plan={plan}>
          <div className={css.summary}>
            <button type="button" className={css.back} onClick={() => router.push('/upgrade')}>
              <ArrowLeft size={16} aria-hidden />
              Plans
            </button>

            <div className={css.topMeta}>
              <span className={css.kicker}>Secure checkout</span>
              <span className={css.dot} aria-hidden />
              <span className={css.trust}>
                <Shield size={13} strokeWidth={2} aria-hidden />
                Payments processed by Stripe
              </span>
            </div>

            <div className={css.logoRow}>
              <div className={css.logoMark}>
                <Image src="/aladdin-logo.png" alt="Aladdin" width={34} height={34} />
              </div>
              <span className={css.brandName}>Aladdin</span>
            </div>

            <span className={css.planPill}>{copy.pillLabel}</span>
            <h1 className={css.headline}>{copy.headline}</h1>
            <div className={css.priceBlock}>
              <span className={css.price}>{copy.price}</span>
              <span className={css.interval}>{copy.interval}</span>
            </div>
            <p className={css.tagline}>{copy.tagline}</p>

            <ul className={css.features}>
              {copy.bullets.map((line) => (
                <li key={line} className={css.feature}>
                  <span className={css.checkWrap}>
                    <Check size={12} strokeWidth={2.75} aria-hidden />
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className={css.footnote}>
              Taxes (if any) appear in the payment panel. Renews monthly until you cancel in Manage plan; after cancel,
              paid access continues through the period you already paid for.
            </p>
          </div>

          <div className={css.checkoutCol}>
            <p className={css.paymentLabel}>Payment</p>
            <div className={css.paymentWell}>
              {!clientSecret || !stripePromise ? (
                <div className={css.loader}>
                  <div className={css.spinner} />
                  <span>Loading payment form…</span>
                </div>
              ) : (
                <div className={css.embedSlot}>
                  <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                    <EmbeddedCheckout />
                  </EmbeddedCheckoutProvider>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
