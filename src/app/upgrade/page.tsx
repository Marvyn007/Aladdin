'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import NumberFlow from '@number-flow/react';
import {
  ArrowLeft, CheckCheck, Briefcase, Mail, AtSign,
  Map, LayoutDashboard, MessageSquare, Shield,
} from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { cn } from '@/lib/utils';

const plans = [
  {
    id: 'LITE' as const,
    name: 'Aladdin Lite',
    description:
      'Explore hundreds of openings, track every application, and prep for interviews — completely free.',
    price: 0,
    yearlyPrice: 0,
    buttonText: 'Get started free',
    buttonVariant: 'outline' as const,
    priceId: null as string | null,
    features: [
      { text: 'Jobs Map & Live Listings', icon: <Map size={18} /> },
      { text: 'Application Tracker & Heatmap', icon: <LayoutDashboard size={18} /> },
      { text: 'Interview Prep & Tech Questions', icon: <MessageSquare size={18} /> },
    ],
    includes: [
      'Free includes:',
      'Static Resume Editor',
      'Unlimited job saves',
      'Career heatmap analytics',
    ],
  },
  {
    id: 'COPILOT' as const,
    name: 'Co-Pilot',
    description:
      "Let AI rewrite your resume for every role, draft cover letters, and reveal who can refer you.",
    price: 6.99,
    yearlyPrice: 5.59,
    buttonText: 'Start Co-Pilot',
    buttonVariant: 'default' as const,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_COPILOT ?? null,
    popular: true,
    features: [
      { text: '15 AI Resume Tailorings / mo', icon: <Briefcase size={18} /> },
      { text: '30 Cover Letters / mo', icon: <Mail size={18} /> },
      { text: '30 Email Reveals / mo', icon: <AtSign size={18} /> },
    ],
    includes: [
      'Everything in Lite, plus:',
      '60 LinkedIn Profile Views / mo',
      'AI resume scoring & suggestions',
      'Company contact discovery',
    ],
  },
  {
    id: 'CAPTAIN' as const,
    name: 'Captain',
    description:
      'Maximum output for serious job seekers — high-volume AI tools that keep you ahead of every competitor.',
    price: 16.99,
    yearlyPrice: 13.59,
    buttonText: 'Become Captain',
    buttonVariant: 'outline' as const,
    priceId: process.env.NEXT_PUBLIC_STRIPE_PRICE_CAPTAIN ?? null,
    features: [
      { text: '60 AI Resume Tailorings / mo', icon: <Briefcase size={18} /> },
      { text: 'Unlimited Cover Letters*', icon: <Mail size={18} /> },
      { text: '150 Email Reveals / mo', icon: <AtSign size={18} /> },
    ],
    includes: [
      'Everything in Co-Pilot, plus:',
      'Unlimited LinkedIn Profiles*',
      '4× the output of Co-Pilot',
      'Priority feature access',
    ],
  },
];

const PricingSwitch = ({ isYearly, onSwitch }: { isYearly: boolean; onSwitch: (v: string) => void }) => {
  return (
    <div className="flex justify-center">
      <div className="relative z-50 mx-auto flex w-fit rounded-full bg-white border border-gray-200 p-1 shadow-sm">
        <button
          onClick={() => onSwitch('0')}
          className={cn(
            'relative z-10 w-fit h-10 sm:h-11 rounded-full px-5 sm:px-6 py-1 sm:py-2 font-medium transition-colors text-sm',
            !isYearly ? 'text-white' : 'text-gray-500 hover:text-gray-900',
          )}
        >
          {!isYearly && (
            <motion.span
              layoutId="billing-switch"
              className="absolute top-0 left-0 h-10 sm:h-11 w-full rounded-full border-[3px] shadow-md shadow-blue-500/40 border-blue-500 bg-gradient-to-b from-blue-400 to-blue-600"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative">Monthly</span>
        </button>

        <button
          onClick={() => onSwitch('1')}
          className={cn(
            'relative z-10 w-fit h-10 sm:h-11 flex-shrink-0 rounded-full px-5 sm:px-6 py-1 sm:py-2 font-medium transition-colors text-sm',
            isYearly ? 'text-white' : 'text-gray-500 hover:text-gray-900',
          )}
        >
          {isYearly && (
            <motion.span
              layoutId="billing-switch"
              className="absolute top-0 left-0 h-10 sm:h-11 w-full rounded-full border-[3px] shadow-md shadow-blue-500/40 border-blue-500 bg-gradient-to-b from-blue-400 to-blue-600"
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          )}
          <span className="relative flex items-center gap-2">
            Yearly
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
              Save 20%
            </span>
          </span>
        </button>
      </div>
    </div>
  );
};

export default function UpgradePage() {
  const router = useRouter();
  const sub = useSubscription();
  const [isYearly, setIsYearly] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const togglePricingPeriod = (value: string) => setIsYearly(parseInt(value) === 1);

  const handleUpgrade = async (priceId: string) => {
    setLoading(priceId);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const handleManage = async () => {
    setLoading('portal');
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' });
      const data = await res.json() as { url?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  };

  const revealVariants = {
    visible: (i: number) => ({
      y: 0,
      opacity: 1,
      filter: 'blur(0px)',
      transition: { delay: i * 0.12, duration: 0.5 },
    }),
    hidden: { filter: 'blur(8px)', y: -16, opacity: 0 },
  };

  return (
    <div className="relative min-h-screen bg-neutral-100 px-4 pt-8 pb-20 overflow-x-hidden">
      {/* Blue radial glow overlay */}
      <div
        className="pointer-events-none absolute top-0 left-[5%] right-[5%] w-[90%] h-[70vh] z-0"
        style={{
          backgroundImage: 'radial-gradient(ellipse at 50% 0%, #3b82f6 0%, transparent 68%)',
          opacity: 0.55,
          mixBlendMode: 'multiply',
        }}
      />

      {/* Back button */}
      <div className="relative z-10 mb-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={14} strokeWidth={2} />
          Back
        </button>
      </div>

      {/* Hero text */}
      <div className="relative z-10 text-center mb-8 max-w-3xl mx-auto">
        <motion.h2
          custom={0}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="text-4xl sm:text-5xl md:text-6xl font-semibold text-gray-900 mb-4 tracking-tight leading-tight"
        >
          Plans that work best for your{' '}
          <motion.span
            custom={1}
            initial="hidden"
            animate="visible"
            variants={revealVariants}
            className="border border-dashed border-blue-500 px-3 py-1 rounded-xl bg-blue-100 inline-block"
          >
            job search
          </motion.span>
        </motion.h2>

        <motion.p
          custom={2}
          initial="hidden"
          animate="visible"
          variants={revealVariants}
          className="text-sm sm:text-base text-gray-600 w-[80%] sm:w-[60%] mx-auto"
        >
          From your first application to your last offer — Aladdin has a plan that grows with your ambition.
        </motion.p>
      </div>

      {/* Toggle */}
      <motion.div
        custom={3}
        initial="hidden"
        animate="visible"
        variants={revealVariants}
        className="relative z-10 mb-8"
      >
        <PricingSwitch isYearly={isYearly} onSwitch={togglePricingPeriod} />
      </motion.div>

      {/* Cards */}
      <div className="relative z-10 grid md:grid-cols-3 max-w-5xl gap-4 mx-auto">
        {plans.map((plan, index) => {
          const isCurrent = sub.planType === plan.id;
          const isLite = plan.id === 'LITE';

          return (
            <motion.div
              key={plan.id}
              custom={4 + index}
              initial="hidden"
              animate="visible"
              variants={revealVariants}
              className={cn(
                'relative rounded-2xl border bg-white flex flex-col',
                plan.popular
                  ? 'ring-2 ring-blue-500 border-blue-200 bg-blue-50/40'
                  : 'border-neutral-200',
              )}
            >
              {/* Card header */}
              <div className="p-6 pb-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="text-2xl sm:text-3xl font-semibold text-gray-900">{plan.name}</h3>
                  {plan.popular && (
                    <span className="bg-blue-500 text-white text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0 ml-2 mt-1">
                      Popular
                    </span>
                  )}
                </div>

                <p className="text-sm text-gray-500 mb-4 leading-relaxed">{plan.description}</p>

                <div className="flex items-baseline gap-0.5 mb-1">
                  {isLite ? (
                    <span className="text-4xl font-semibold text-gray-900">Free</span>
                  ) : (
                    <>
                      <span className="text-4xl font-semibold text-gray-900">$</span>
                      <NumberFlow
                        value={isYearly ? plan.yearlyPrice : plan.price}
                        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                        className="text-4xl font-semibold text-gray-900"
                      />
                      <span className="text-gray-500 ml-1 text-sm">
                        /month{isYearly ? ', billed yearly' : ''}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* CTA button */}
              <div className="px-6 pb-4">
                {isCurrent ? (
                  <div className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-500 text-sm font-semibold text-center border border-gray-200">
                    Current plan
                  </div>
                ) : isLite ? (
                  <div className="w-full py-3.5 rounded-xl bg-gray-100 text-gray-400 text-sm font-semibold text-center border border-gray-200">
                    Free forever
                  </div>
                ) : (
                  <button
                    onClick={() => sub.planType === 'LITE' ? handleUpgrade(plan.priceId!) : handleManage()}
                    disabled={loading !== null}
                    className={cn(
                      'w-full py-3.5 text-sm font-semibold rounded-xl text-white transition-opacity',
                      plan.popular
                        ? 'bg-gradient-to-b from-blue-400 to-blue-600 shadow-lg shadow-blue-400/30 border border-blue-400/50'
                        : 'bg-gradient-to-b from-neutral-700 to-neutral-900 shadow-lg shadow-neutral-900/30 border border-neutral-700/50',
                      loading !== null ? 'opacity-60 cursor-wait' : 'hover:opacity-90',
                    )}
                  >
                    {loading === plan.priceId
                      ? 'Redirecting…'
                      : sub.planType !== 'LITE'
                      ? 'Manage plan'
                      : plan.buttonText}
                  </button>
                )}
              </div>

              {/* Usage features */}
              <div className="px-6 pb-4">
                <ul className="space-y-2.5">
                  {plan.features.map((feature, fi) => (
                    <li key={fi} className="flex items-center gap-3">
                      <span className="text-neutral-700 flex-shrink-0">{feature.icon}</span>
                      <span className="text-sm text-gray-600">{feature.text}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Includes section */}
              <div className="px-6 pb-6 pt-2 border-t border-neutral-200 mt-auto">
                <h4 className="font-semibold text-sm text-gray-900 mb-3 mt-3">{plan.includes[0]}</h4>
                <ul className="space-y-2.5">
                  {plan.includes.slice(1).map((feature, fi) => (
                    <li key={fi} className="flex items-center gap-3">
                      <span className="h-5 w-5 rounded-full bg-blue-50 border border-blue-400 flex items-center justify-center flex-shrink-0">
                        <CheckCheck className="h-3 w-3 text-blue-500" />
                      </span>
                      <span className="text-sm text-gray-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Footer */}
      <motion.div
        custom={8}
        initial="hidden"
        animate="visible"
        variants={revealVariants}
        className="relative z-10 mt-10 flex flex-col items-center gap-2"
      >
        <div className="flex items-center gap-2 text-gray-500">
          <Shield size={13} strokeWidth={2} />
          <span className="text-xs">Cancel anytime · Billed securely via Stripe · No hidden fees</span>
        </div>
        <p className="text-[11px] text-gray-400">
          * Unlimited subject to fair use policy (500/mo). Usage resets on your billing date.
        </p>
      </motion.div>
    </div>
  );
}
