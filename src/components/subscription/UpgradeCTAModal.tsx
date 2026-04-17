'use client';

import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Zap, Rocket, Star, ArrowRight, Lock } from 'lucide-react';
import NumberFlow from '@number-flow/react';
import { useSubscription } from '@/hooks/useSubscription';

const PLANS = [
  {
    id: 'LITE' as const,
    name: 'Aladdin Lite',
    price: 0,
    Icon: Star,
    tagline: 'Basic access',
  },
  {
    id: 'COPILOT' as const,
    name: 'Co-Pilot',
    price: 6.99,
    Icon: Zap,
    tagline: '15 resumes · 30 cover letters',
    popular: true,
  },
  {
    id: 'CAPTAIN' as const,
    name: 'Captain',
    price: 16.99,
    Icon: Rocket,
    tagline: '60 resumes · unlimited more',
  },
];

const PLAN_ORDER = { LITE: 0, COPILOT: 1, CAPTAIN: 2 };

interface UpgradeCTAModalProps {
  isOpen: boolean;
  onClose: () => void;
  reason?: string;
}

export function UpgradeCTAModal({ isOpen, onClose, reason }: UpgradeCTAModalProps) {
  const router = useRouter();
  const sub = useSubscription();
  const [mounted, setMounted] = useState(false);

  // Pre-select the next upgrade tier
  const defaultIndex = Math.min((PLAN_ORDER[sub.planType] ?? 0) + 1, 2);
  const [active, setActive] = useState(defaultIndex);
  const [animatedPrices, setAnimatedPrices] = useState([0, 0, 0]);
  const hasAnimated = useRef(false);

  useEffect(() => { setMounted(true); }, []);

  // Animate prices in when modal opens
  useEffect(() => {
    if (!isOpen || hasAnimated.current) return;
    hasAnimated.current = true;
    const timer = setTimeout(() => {
      setAnimatedPrices(PLANS.map(p => p.price));
    }, 80);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Reset animation flag when closed
  useEffect(() => {
    if (!isOpen) hasAnimated.current = false;
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  if (!isOpen || !mounted) return null;

  const ROW_H = 72;
  const GAP = 8;

  function handleContinue() {
    onClose();
    router.push('/upgrade');
  }

  const contextTitle = reason ?? 'Unlock this feature';
  const contextSub = sub.planType === 'LITE'
    ? 'Upgrade to access AI-powered job search tools.'
    : 'You\'ve reached your monthly limit.';

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(3px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 10001, padding: '20px',
        animation: 'ctaFadeIn 0.18s ease',
      }}
    >
      <style>{`
        @keyframes ctaFadeIn { from { opacity:0 } to { opacity:1 } }
        @keyframes ctaSlideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        .upgrade-plan-row:hover { background: var(--background-secondary) !important; }
      `}</style>

      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--background)',
          borderRadius: '20px',
          width: '100%',
          maxWidth: '380px',
          padding: '24px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.22)',
          border: '1px solid var(--border)',
          position: 'relative',
          animation: 'ctaSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: '16px', right: '16px',
            background: 'var(--background-secondary)', border: 'none',
            borderRadius: '8px', width: '28px', height: '28px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: 'var(--text-secondary)',
          }}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '20px', paddingRight: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '8px',
              background: 'var(--accent-muted)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--accent)',
            }}>
              <Lock size={14} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>
              {contextTitle}
            </span>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, paddingLeft: '36px' }}>
            {contextSub}
          </p>
        </div>

        {/* Plan selector */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: `${GAP}px`, marginBottom: '16px' }}>

          {/* Sliding indicator */}
          <div style={{
            position: 'absolute',
            top: 0, left: 0, right: 0,
            height: `${ROW_H}px`,
            borderRadius: '12px',
            border: `2px solid var(--accent)`,
            pointerEvents: 'none',
            zIndex: 2,
            transform: `translateY(${active * (ROW_H + GAP)}px)`,
            transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1)',
            boxShadow: '0 0 0 3px var(--accent-muted)',
          }} />

          {PLANS.map((plan, i) => {
            const isActive = active === i;
            const isCurrent = sub.planType === plan.id;
            return (
              <div
                key={plan.id}
                className="upgrade-plan-row"
                onClick={() => setActive(i)}
                style={{
                  height: `${ROW_H}px`,
                  borderRadius: '12px',
                  padding: '0 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  transition: 'background 0.15s ease',
                  position: 'relative',
                  zIndex: 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {/* Radio dot */}
                  <div style={{
                    width: '18px', height: '18px', borderRadius: '50%',
                    border: `2px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'border-color 0.2s',
                    flexShrink: 0,
                  }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--accent)',
                      opacity: isActive ? 1 : 0,
                      transform: `scale(${isActive ? 1 : 0.4})`,
                      transition: 'opacity 0.2s, transform 0.2s',
                    }} />
                  </div>

                  {/* Plan info */}
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                        {plan.name}
                      </span>
                      {plan.popular && (
                        <span style={{
                          fontSize: '10px', fontWeight: 600, letterSpacing: '0.03em',
                          background: 'var(--accent-muted)', color: 'var(--accent)',
                          padding: '2px 7px', borderRadius: '99px',
                        }}>
                          Popular
                        </span>
                      )}
                      {isCurrent && (
                        <span style={{
                          fontSize: '10px', fontWeight: 500,
                          color: 'var(--text-secondary)',
                          padding: '2px 7px', borderRadius: '99px',
                          border: '1px solid var(--border)',
                        }}>
                          Current
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '1px' }}>
                      {plan.tagline}
                    </div>
                  </div>
                </div>

                {/* Price */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {plan.price === 0 ? (
                    <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}>Free</span>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '1px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)' }}>$</span>
                      <NumberFlow
                        value={animatedPrices[i]}
                        format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }}
                        style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)' }}
                      />
                    </div>
                  )}
                  {plan.price > 0 && (
                    <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>/mo</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* CTA button */}
        <button
          onClick={handleContinue}
          style={{
            width: '100%',
            padding: '13px',
            borderRadius: '12px',
            border: 'none',
            background: 'var(--accent)',
            color: 'white',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'opacity 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'scale(0.99)'; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseDown={e => { e.currentTarget.style.transform = 'scale(0.97)'; }}
          onMouseUp={e => { e.currentTarget.style.transform = 'scale(0.99)'; }}
        >
          View all plans
          <ArrowRight size={15} />
        </button>

        <p style={{ margin: '10px 0 0', fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center' }}>
          Cancel anytime · Billed monthly
        </p>
      </div>
    </div>,
    document.body
  );
}
