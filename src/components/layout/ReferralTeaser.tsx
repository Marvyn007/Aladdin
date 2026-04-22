'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Lock, ArrowRight, Loader2, Users, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@clerk/nextjs';
import { useSubscription } from '@/hooks/useSubscription';
import { LiteUpgradeModal } from '@/components/subscription/LiteUpgradeModal';
import { LimitReachedModal } from '@/components/subscription/LimitReachedModal';
import { CaptainLimitModal } from '@/components/subscription/CaptainLimitModal';
import { AuthModal } from '@/components/modals/AuthModal';
import { announcePriorityModalOpening, usePriorityModalCleanup } from '@/lib/priority-modal';

// ── Types ──────────────────────────────────────────────────────────────────

interface TeaserContact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
  email: string | null;
  emailStatus: string | null;
}

interface SearchResult {
  contacts: TeaserContact[];
  totalEntries: number;
  cached: boolean;
}

type GateModal = { type: 'lite' } | { type: 'limit'; resetDate: string | null };

// ── Helpers ────────────────────────────────────────────────────────────────

function buildPlaceholderAvatarUrls(seed: string): string[] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  const out: string[] = [];
  const used = new Set<number>();
  let x = Math.abs(h) || 1;
  while (out.length < 3) {
    const n = (x % 70) + 1;
    x += 11;
    if (!used.has(n)) {
      used.add(n);
      out.push(`https://i.pravatar.cc/128?img=${n}`);
    }
  }
  return out;
}

const LOCAL_AVATAR_PATHS = [
  '/avatars/splitimage.im-1.png',
  '/avatars/splitimage.im-2.png',
  '/avatars/splitimage.im-3.png',
  '/avatars/splitimage.im-4.png',
  '/avatars/splitimage.im-5.png',
  '/avatars/splitimage.im-6.png',
  '/avatars/splitimage.im-7.png',
  '/avatars/splitimage.im-8.png',
  '/avatars/splitimage.im-9.png',
  '/avatars/splitimage.im-10.png',
  '/avatars/splitimage.im-11.png',
  '/avatars/splitimage.im-12.png',
] as const;

const MODAL_CONTACT_PREVIEW = 5;

const LINKEDIN_LOGO_SRC =
  'https://img.logo.dev/linkedin.com?token=pk_b-8PjthySeKn8CjgOa7NeA&retina=true';

function seededShufflePaths(seed: string, paths: readonly string[]): string[] {
  const out = [...paths];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = seed.charCodeAt(i) + ((h << 5) - h);
  }
  let x = Math.abs(h) || 1;
  for (let i = out.length - 1; i > 0; i--) {
    x = (x * 16807 + 12345) % 0x7fffffff;
    const j = x % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ── Compact modal table ────────────────────────────────────────────────────

function ReferralModal({
  contacts,
  companyName,
  companyDomain,
  isLoading,
  canViewLinkedin,
  onClose,
  onLinkedinLocked,
  onLinkedinView,
}: {
  contacts: TeaserContact[];
  companyName: string;
  companyDomain: string;
  isLoading: boolean;
  canViewLinkedin: boolean;
  onClose: () => void;
  onLinkedinLocked: () => void;
  onLinkedinView: (contactId: string, linkedinUrl: string) => void;
}) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const { displayed } = useMemo(() => {
    const rows = contacts.slice(0, MODAL_CONTACT_PREVIEW);
    const shuffled = seededShufflePaths(`${companyDomain}|referral-modal`, LOCAL_AVATAR_PATHS);
    const avatars = rows.map((_, i) => shuffled[i % shuffled.length]);
    return { displayed: rows, rowAvatarSrcs: avatars };
  }, [contacts, companyDomain]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handler);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handler);
      document.body.style.overflow = '';
    };
  }, [onClose]);

  function handleOverlayClick(e: React.MouseEvent) {
    if (e.target === overlayRef.current) onClose();
  }

  function handleViewAll() {
    onClose();
    router.push(`/find-referrals?domain=${encodeURIComponent(companyDomain)}`);
  }

  return createPortal(
    <div
      ref={overlayRef}
      className="rt-modal-overlay"
      onClick={handleOverlayClick}
      aria-modal="true"
      role="dialog"
      aria-label={`Referrals at ${companyName}`}
    >
      <div className="rt-modal">
        <div className="rt-modal-header">
          <div className="rt-modal-heading">
            <h2 className="rt-modal-title">Referrals</h2>
            <p className="rt-modal-subtitle">
              Connect with the team at <span className="rt-modal-subtitle-strong">{companyName}</span>.
            </p>
          </div>
          <button className="rt-modal-close" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="rt-modal-body no-scrollbar">
          {isLoading ? (
            <div className="rt-modal-state">
              <Loader2 size={20} className="rt-spin" />
              <span>Loading contacts…</span>
            </div>
          ) : contacts.length === 0 ? (
            <div className="rt-modal-state">
              <Users size={24} strokeWidth={1.5} />
              <p>No contacts found for this company yet.</p>
              <button className="rt-view-all-btn" onClick={handleViewAll}>
                Search on Find Referrals <ArrowRight size={14} />
              </button>
            </div>
          ) : (
            <div className="rt-table-card" role="region" aria-label="Referral contacts table">
              <table className="rt-table">
                <colgroup>
                  <col className="rt-col-name" />
                  <col className="rt-col-title" />
                  <col className="rt-col-email" />
                  <col className="rt-col-linkedin" />
                </colgroup>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Title</th>
                    <th>Email</th>
                    <th className="rt-th-right">LinkedIn</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((contact) => {
                    const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
                    return (
                      <tr key={contact.id} className="rt-row">
                        <td>
                          <span className="rt-person-name">{fullName}</span>
                        </td>
                        <td>
                          <span className="rt-title">{contact.title || '—'}</span>
                        </td>
                        <td>
                          <span className="rt-email-locked rt-email-locked--hint">
                            <Lock size={11} />
                            <span>Reveal on referrals page</span>
                          </span>
                        </td>
                        <td className="rt-td-right">
                          {canViewLinkedin && contact.linkedinUrl ? (
                            <button
                              onClick={() => onLinkedinView(contact.id, contact.linkedinUrl!)}
                              className="rt-linkedin-btn"
                              title="View LinkedIn profile"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <Image
                                src={LINKEDIN_LOGO_SRC}
                                alt=""
                                width={13}
                                height={13}
                                style={{ borderRadius: 4, flexShrink: 0 }}
                              />
                              <span>View</span>
                              <ExternalLink size={10} />
                            </button>
                          ) : (
                            <button
                              onClick={canViewLinkedin ? undefined : onLinkedinLocked}
                              className="rt-linkedin-btn rt-linkedin-btn--locked"
                              title={canViewLinkedin ? undefined : 'Upgrade to view LinkedIn'}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                            >
                              <Image
                                src={LINKEDIN_LOGO_SRC}
                                alt=""
                                width={13}
                                height={13}
                                style={{ borderRadius: 4, flexShrink: 0, opacity: 0.45 }}
                              />
                              <Lock size={10} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!isLoading && contacts.length > 0 && (
          <div className="rt-modal-actions">
            <button className="rt-view-all-btn" onClick={handleViewAll}>
              View all referrals
              <ArrowRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

// ── Main teaser component ──────────────────────────────────────────────────

interface ReferralTeaserProps {
  companyDomain: string | null;
  companyName: string;
}

export function ReferralTeaser({ companyDomain, companyName }: ReferralTeaserProps) {
  const { isSignedIn } = useAuth();
  const sub = useSubscription();
  const [contacts, setContacts] = useState<TeaserContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [gateModal, setGateModal] = useState<GateModal | null>(null);

  const placeholderAvatarUrls = useMemo(
    () => buildPlaceholderAvatarUrls(`${companyDomain}|${companyName}`),
    [companyDomain, companyName],
  );

  // Local counter so the UI updates immediately after each reveal without waiting for a refetch
  const [localLinkedinCount, setLocalLinkedinCount] = useState(0);

  const closeNonPriorityModals = useCallback(() => {
    setIsModalOpen(false);
    setAuthModalOpen(false);
    setGateModal(null);
  }, []);

  usePriorityModalCleanup(closeNonPriorityModals);

  const showGateModal = useCallback((modal: GateModal) => {
    announcePriorityModalOpening();
    closeNonPriorityModals();
    setGateModal(modal);
  }, [closeNonPriorityModals]);

  const linkedinUsed = sub.usage.linkedinRetrieved + localLinkedinCount;
  const canViewLinkedin = !sub.isLoading
    && sub.planType !== 'LITE'
    && linkedinUsed < sub.limits.linkedinRetrieved;

  function handleLinkedinLocked() {
    if (sub.isLoading) return;
    if (sub.planType === 'LITE') {
      showGateModal({ type: 'lite' });
    } else {
      showGateModal({ type: 'limit', resetDate: sub.currentPeriodEnd });
    }
  }

  async function handleLinkedinView(contactId: string, linkedinUrl: string) {
    try {
      const res = await fetch(`/api/contacts/${contactId}/linkedin-view`, { method: 'POST' });
      if (res.status === 403) {
        const body = await res.json().catch(() => ({})) as { error?: string; resetDate?: string };
        if (body.error === 'UNAUTHORIZED') {
          showGateModal({ type: 'lite' });
        } else {
          showGateModal({ type: 'limit', resetDate: body.resetDate ?? null });
        }
        return;
      }
      // Success — track usage locally and refresh global subscription state
      setLocalLinkedinCount(c => c + 1);
      window.dispatchEvent(new Event('aladdin:subscription-refresh'));
      window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Non-fatal — still open the URL
      window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    }
  }

  const fetchContacts = useCallback(async () => {
    if (!companyDomain || hasFetched) return;
    setIsLoading(true);
    setHasFetched(true);
    try {
      const res = await fetch('/api/contacts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyDomain }),
      });
      if (!res.ok) return;
      const data = await res.json() as SearchResult;
      setContacts(data.contacts);
    } catch {
      // Silently fail — teaser is non-critical
    } finally {
      setIsLoading(false);
    }
  }, [companyDomain, hasFetched]);

  useEffect(() => {
    setContacts([]);
    setHasFetched(false);
    setIsModalOpen(false);
  }, [companyDomain]);

  if (!companyDomain) return null;

  function handleClick() {
    if (!isSignedIn) { setAuthModalOpen(true); return; }
    setIsModalOpen(true);
    if (!hasFetched) fetchContacts();
  }

  return (
    <>
      <button
        className={`rt-teaser ${isLoading ? 'rt-teaser--loading' : ''}`}
        onClick={handleClick}
        type="button"
      >
        <div className="rt-teaser-avatars">
          {placeholderAvatarUrls.map(src => (
            <div key={src} className="rt-teaser-avatar rt-teaser-avatar--photo-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                className={`rt-teaser-avatar-photo ${isLoading ? 'rt-teaser-avatar-photo--pulse' : ''}`}
                width={24}
                height={24}
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
        <p className="rt-teaser-text">
          <span>See who can refer you at</span>
          <strong className="rt-teaser-company">{companyName}</strong>
          <span className="rt-teaser-link">
            See contacts
            <ArrowRight size={12} className="rt-teaser-link-icon" aria-hidden />
          </span>
        </p>
      </button>

      {isModalOpen && (
        <ReferralModal
          contacts={contacts}
          companyName={companyName}
          companyDomain={companyDomain}
          isLoading={isLoading}
          canViewLinkedin={canViewLinkedin}
          onClose={() => setIsModalOpen(false)}
          onLinkedinLocked={handleLinkedinLocked}
          onLinkedinView={handleLinkedinView}
        />
      )}

      <LiteUpgradeModal
        open={gateModal?.type === 'lite'}
        onClose={() => setGateModal(null)}
      />
      {sub.planType === 'CAPTAIN' ? (
        <CaptainLimitModal
          open={gateModal?.type === 'limit'}
          onClose={() => setGateModal(null)}
          resetDate={gateModal?.type === 'limit' ? gateModal.resetDate : null}
        />
      ) : (
        <LimitReachedModal
          open={gateModal?.type === 'limit'}
          onClose={() => setGateModal(null)}
          feature="linkedinRetrieved"
          resetDate={gateModal?.type === 'limit' ? gateModal.resetDate : null}
        />
      )}
      <AuthModal isOpen={authModalOpen} onClose={() => setAuthModalOpen(false)} />
    </>
  );
}
