'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { loadStripe } from '@stripe/stripe-js';
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from '@stripe/react-stripe-js';
import { ArrowLeft, Check } from 'lucide-react';
import css from '@/components/upgrade/upgrade-checkout.module.css';
import type { CheckoutPlanKey } from '@/lib/stripe/checkout-price';

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const PLAN_COPY: Record<
  CheckoutPlanKey,
  { headline: string; price: string; interval: string; tagline: string; bullets: string[] }
> = {
  copilot: {
    headline: 'Subscribe to Aladdin Co-Pilot',
    price: '$6.99',
    interval: '/ month',
    tagline: 'AI-assisted applications, outreach, and tracking—built for serious job seekers.',
    bullets: [
      'AI-tailored resumes each billing period (see plan limits in-app)',
      'High-conversion cover letters for more replies',
      'LinkedIn profile insights for warmer outreach',
      'Referral network access inside Aladdin',
      'Apply Pilot auto-fill on supported applications',
    ],
  },
  captain: {
    headline: 'Subscribe to Aladdin Captain',
    price: '$16.99',
    interval: '/ month',
    tagline: 'Maximum reach: more resumes, verified contacts, and priority signal on new roles.',
    bullets: [
      'Higher monthly caps on tailored resumes and verified emails',
      'Unlimited AI cover letters where your plan allows',
      'Unlimited LinkedIn lead depth where your plan allows',
      'Priority “first-to-apply” style alerts in the product',
      'Everything included in Co-Pilot',
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
          <p style={{ textAlign: 'center', marginTop: '1rem' }}>
            <Link href="/upgrade" style={{ color: '#0d9488', fontWeight: 600 }}>
              Back to plans
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const copy = PLAN_COPY[plan];

  return (
    <div className={css.page}>
      <div className={css.inner}>
        <div className={css.grid}>
          <div className={css.summary}>
            <button type="button" className={css.back} onClick={() => router.push('/upgrade')}>
              <ArrowLeft size={16} aria-hidden />
              Back
            </button>

            <div className={css.logoRow}>
              <Image src="/aladdin-logo.png" alt="Aladdin" width={36} height={36} />
              <span className={css.brandName}>Aladdin</span>
            </div>

            <h1 className={css.headline}>{copy.headline}</h1>
            <div className={css.priceRow}>
              <span className={css.price}>{copy.price}</span>
              <span className={css.interval}>{copy.interval}</span>
            </div>
            <p className={css.tagline}>{copy.tagline}</p>

            <ul className={css.features}>
              {copy.bullets.map((line) => (
                <li key={line} className={css.feature}>
                  <Check className={css.checkIcon} size={16} strokeWidth={2.25} aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <p className={css.footnote}>
              Taxes (if any) appear in the payment panel. Your subscription renews each month until you cancel from
              Manage plan. After cancellation, you keep paid access through the end of the period you already paid for.
            </p>
          </div>

          <div className={css.checkoutCol}>
            {!clientSecret || !stripePromise ? (
              <div className={css.loader} style={{ minHeight: 320 }}>
                <div className={css.spinner} />
                <span>Loading payment form…</span>
              </div>
            ) : (
              <EmbeddedCheckoutProvider stripe={stripePromise} options={{ clientSecret }}>
                <EmbeddedCheckout />
              </EmbeddedCheckoutProvider>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
