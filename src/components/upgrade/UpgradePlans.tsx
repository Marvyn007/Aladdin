'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check } from 'lucide-react';
import styles from '@/components/upgrade/upgrade.module.css';

type Plan = {
  id: string;
  title: string;
  badge?: string;
  tagline: string;
  price: string;
  features: string[];
  imageSrc: string;
  imageTransparent?: boolean;
  ctaLabel: string;
  ctaVariant: 'secondary' | 'primary';
  ctaNav: 'none' | 'upgrade';
};

const plans: Plan[] = [
  {
    id: 'lite',
    title: 'Lite',
    tagline: 'Everything you need for job search. All-added-in.',
    price: 'Free',
    features: [
      'Visual Jobs Map & Discovery',
      'Application Tracker',
      'Daily Activity Heatmap',
      'Interview & Technical Practice',
      'Static Resume Editor (No AI)',
    ],
    imageSrc: '/upgrade/tree-blossom-large.png',
    imageTransparent: true,
    ctaLabel: 'Stay Free',
    ctaVariant: 'secondary',
    ctaNav: 'none',
  },
  {
    id: 'pilot',
    title: 'Copilot',
    badge: 'Best Value',
    tagline: 'Your job hunt on autopilot. Move 10x faster.',
    price: '$6.99/mo',
    features: [
      'Everything in Lite',
      '15x AI-Tailored Resumes per month',
      '30x High-Conversion Cover Letters',
      '60x LinkedIn Profile Insights',
      'Unlock Referral Network Access (The "Secret Door")',
      'Advanced "Apply Pilot" Auto-fill',
    ],
    imageSrc: '/upgrade/tree-cashew.png',
    ctaLabel: 'Upgrade to Co-Pilot',
    ctaVariant: 'primary',
    ctaNav: 'upgrade',
  },
  {
    id: 'captain',
    title: 'Captain',
    tagline: 'Dominate the hidden job market. Total command.',
    price: '$16.99/mo',
    features: [
      'Everything in Co-Pilot',
      '60x Premium Tailored Resumes',
      '150x Verified Email Retrievals (Direct Access)',
      'Unlimited AI Cover Letters',
      'Unlimited LinkedIn Lead Scraping',
      'Priority "First-to-Apply" Alerts',
    ],
    imageSrc: '/upgrade/tree-blossom.png',
    ctaLabel: 'Take Full Command',
    ctaVariant: 'primary',
    ctaNav: 'upgrade',
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  const router = useRouter();
  const tight = plan.imageTransparent;
  const treeWrapClass = tight ? `${styles.treeWrap} ${styles.treeWrapTransparent}` : styles.treeWrap;
  const imgW = tight ? 56 : 80;
  const imgH = tight ? 56 : 80;

  function handleCta() {
    if (plan.ctaNav !== 'upgrade') return;
    const checkoutPlan = plan.id === 'captain' ? 'captain' : plan.id === 'pilot' ? 'copilot' : null;
    if (!checkoutPlan) return;
    router.push(`/upgrade/checkout?plan=${checkoutPlan}`);
  }

  const ctaClass =
    plan.ctaVariant === 'primary'
      ? `${styles.cta} ${styles.ctaPrimary}`
      : `${styles.cta} ${styles.ctaSecondary}`;

  return (
    <article className={styles.card}>
      <div className={styles.cardBody}>
        <div className={styles.cardTop}>
          <div>
            <div className={styles.titleRow}>
              <h2 className={styles.planName}>{plan.title}</h2>
              {plan.badge ? <span className={styles.badge}>{plan.badge}</span> : null}
            </div>
            <p className={styles.price}>{plan.price}</p>
            <p className={styles.tagline}>{plan.tagline}</p>
          </div>
          <div className={`${treeWrapClass} ${styles.treeSlot}`} aria-hidden>
            <Image
              src={plan.imageSrc}
              alt=""
              width={imgW}
              height={imgH}
              className={tight ? `${styles.tree} ${styles.treeMatteKnockout}` : styles.tree}
              sizes={tight ? '56px' : '84px'}
            />
          </div>
        </div>
        <ul className={styles.featureList}>
          {plan.features.map((feature) => (
            <li key={feature} className={styles.featureRow}>
              <Check className={styles.featureIcon} size={16} strokeWidth={2.25} aria-hidden />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        <div className={styles.ctaWrap}>
          <button
            type="button"
            className={ctaClass}
            onClick={plan.ctaNav === 'upgrade' ? handleCta : undefined}
          >
            {plan.ctaLabel}
          </button>
        </div>
      </div>
    </article>
  );
}

export function UpgradePlans() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const sid = searchParams.get('session_id');
    if (!sid) return;
    window.dispatchEvent(new CustomEvent('aladdin:subscription-refresh'));
    router.replace('/upgrade');
  }, [searchParams, router]);

  return (
    <div className={styles.shell}>
      <header className={styles.intro}>
        <p className={styles.kicker}>Pricing plans</p>
        <h1 className={styles.title}>Transparent Pricing, No Surprises</h1>
      </header>

      <div className={styles.grid}>
        {plans.map((plan) => (
          <PlanCard key={plan.id} plan={plan} />
        ))}
      </div>
    </div>
  );
}
