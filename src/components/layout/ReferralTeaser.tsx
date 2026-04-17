'use client';

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { X, Lock, ExternalLink, ArrowRight, Loader2, Users } from 'lucide-react';
import Image from 'next/image';

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

// ── Helpers ────────────────────────────────────────────────────────────────

/** pravatar.cc supports img=1 … 70 for stable face photos */
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

const LINKEDIN_LOGO_SRC =
  'https://img.logo.dev/linkedin.com?token=pk_b-8PjthySeKn8CjgOa7NeA&retina=true';

/** Round avatar art in `public/avatars/` (served as `/avatars/...`). */
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

/** Seeded shuffle so avatar order is “random” but stable for the same seed. */
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
  onClose,
}: {
  contacts: TeaserContact[];
  companyName: string;
  companyDomain: string;
  isLoading: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const overlayRef = useRef<HTMLDivElement>(null);

  const { displayed, rowAvatarSrcs } = useMemo(() => {
    const rows = contacts.slice(0, MODAL_CONTACT_PREVIEW);
    const shuffled = seededShufflePaths(`${companyDomain}|referral-modal`, LOCAL_AVATAR_PATHS);
    const avatars = rows.map((_, i) => shuffled[i % shuffled.length]);
    return { displayed: rows, rowAvatarSrcs: avatars };
  }, [contacts, companyDomain]);

  // Escape to close
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
                  {displayed.map((contact, rowIndex) => {
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
                          {contact.linkedinUrl ? (
                            <a
                              href={contact.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rt-linkedin-btn"
                              title="View LinkedIn profile"
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
                            </a>
                          ) : (
                            <span className="rt-empty">—</span>
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

        {/* Actions */}
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
  const [contacts, setContacts] = useState<TeaserContact[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasFetched, setHasFetched] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const placeholderAvatarUrls = useMemo(
    () => buildPlaceholderAvatarUrls(`${companyDomain}|${companyName}`),
    [companyDomain, companyName],
  );

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

  // Fetch when domain is known
  useEffect(() => {
    setContacts([]);
    setHasFetched(false);
    setIsModalOpen(false);
  }, [companyDomain]);

  if (!companyDomain) return null;

  function handleClick() {
    setIsModalOpen(true);
    // Only fetch when the user asks to see the list
    if (!hasFetched) fetchContacts();
  }

  return (
    <>
      <button
        className={`rt-teaser ${isLoading ? 'rt-teaser--loading' : ''}`}
        onClick={handleClick}
        type="button"
      >
        {/* Avatar stack — always photo avatars (never initials) */}
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

        {/* Text — direct, full-sentence CTA copy */}
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
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </>
  );
}
