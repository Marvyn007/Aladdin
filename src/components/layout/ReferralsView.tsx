'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import {
  Search, Users, Mail, Lock, Eye, Loader2, MapPin, X, ChevronDown, Send,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useSubscription, isFeatureLocked } from '@/hooks/useSubscription';
import { LiteUpgradeModal } from '@/components/subscription/LiteUpgradeModal';
import { LimitReachedModal } from '@/components/subscription/LimitReachedModal';
import { CaptainLimitModal } from '@/components/subscription/CaptainLimitModal';
import type { UsageFeature } from '@/lib/subscription/tier-config';

interface ContactLocation {
  city: string | null;
  country: string | null;
}

interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
  email: string | null;
  emailStatus: string | null;
  location: ContactLocation | null;
}

interface SearchResult {
  contacts: Contact[];
  totalEntries: number;
  cached: boolean;
}

interface RevealResult {
  email: string | null;
  emailStatus: string | null;
  fromCache: boolean;
}

const LINKEDIN_LOGO_SRC =
  'https://img.logo.dev/linkedin.com?token=pk_b-8PjthySeKn8CjgOa7NeA&retina=true';

// ── Seniority inference ────────────────────────────────────────────────────

const SENIORITY_RULES: Array<{ keywords: string[]; label: string }> = [
  { keywords: ['chief', 'ceo', 'cto', 'cfo', 'coo', 'cpo', 'cro', 'founder', 'co-founder', 'president'], label: 'C-Suite' },
  { keywords: ['vp', 'vice president', 'vice-president'], label: 'VP' },
  { keywords: ['director'], label: 'Director' },
  { keywords: ['manager', 'head of', 'head,'], label: 'Manager' },
  { keywords: ['senior', 'sr.', 'lead', 'principal', 'staff', 'architect'], label: 'Senior' },
  { keywords: ['junior', 'jr.', 'entry', 'associate', 'intern'], label: 'Entry' },
];

function inferSeniority(title: string | null): string {
  if (!title) return 'Other';
  const lower = title.toLowerCase();
  for (const { keywords, label } of SENIORITY_RULES) {
    if (keywords.some(k => lower.includes(k))) return label;
  }
  return 'Other';
}

const SENIORITY_BADGE_CLASS: Record<string, string> = {
  'C-Suite': 'referrals-seniority-badge--c-suite',
  'VP': 'referrals-seniority-badge--vp',
  'Director': 'referrals-seniority-badge--director',
  'Manager': 'referrals-seniority-badge--manager',
  'Senior': 'referrals-seniority-badge--senior',
  'Executive': 'referrals-seniority-badge--executive',
  'Entry': 'referrals-seniority-badge--entry',
  'Other': 'referrals-seniority-badge--other',
};

// ── Animated placeholder text ──────────────────────────────────────────────

const SEARCH_PLACEHOLDERS = [
  'stripe.com',
  'google.com',
  'airbnb.com',
  'netflix.com',
  'openai.com',
];

// ── Helpers ────────────────────────────────────────────────────────────────

function extractDomain(input: string): string {
  try {
    const url = input.startsWith('http') ? input : `https://${input}`;
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return input.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

function getInitials(firstName: string | null, lastName: string | null): string {
  return `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase() || '?';
}

function getAvatarColor(name: string): string {
  const colors = [
    'var(--referrals-avatar-1)',
    'var(--referrals-avatar-2)',
    'var(--referrals-avatar-3)',
    'var(--referrals-avatar-4)',
    'var(--referrals-avatar-5)',
  ];
  return colors[name.charCodeAt(0) % colors.length];
}

function buildCounts<T extends string>(items: T[]): Record<T, number> {
  const counts = {} as Record<T, number>;
  for (const item of items) {
    counts[item] = (counts[item] ?? 0) + 1;
  }
  return counts;
}

// ── Animated search input ──────────────────────────────────────────────────

function ReferralsSearchInput({
  value,
  onChange,
  onSubmit,
  isSearching,
  compact,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  isSearching: boolean;
  compact: boolean;
}) {
  const [isActive, setIsActive] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [showPlaceholder, setShowPlaceholder] = useState(true);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Cycle placeholder when inactive
  useEffect(() => {
    if (isActive || value) return;
    const interval = setInterval(() => {
      setShowPlaceholder(false);
      setTimeout(() => {
        setPlaceholderIndex(prev => (prev + 1) % SEARCH_PLACEHOLDERS.length);
        setShowPlaceholder(true);
      }, 350);
    }, 3000);
    return () => clearInterval(interval);
  }, [isActive, value]);

  // Click outside to deactivate
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        if (!value) setIsActive(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [value]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && value.trim()) onSubmit();
  }

  const placeholderLetterVariants = {
    initial: { opacity: 0, filter: 'blur(10px)', y: 8 },
    animate: {
      opacity: 1, filter: 'blur(0px)', y: 0,
      transition: { opacity: { duration: 0.2 }, filter: { duration: 0.35 }, y: { type: 'spring' as const, stiffness: 80, damping: 20 } },
    },
    exit: {
      opacity: 0, filter: 'blur(10px)', y: -8,
      transition: { opacity: { duration: 0.15 }, filter: { duration: 0.25 }, y: { type: 'spring' as const, stiffness: 80, damping: 20 } },
    },
  };

  return (
    <motion.div
      ref={wrapperRef}
      className="referrals-ai-search"
      animate={{
        height: (!compact && (isActive || value)) ? 118 : 60,
      }}
      transition={{ type: 'spring', stiffness: 130, damping: 20 }}
      onClick={() => { setIsActive(true); inputRef.current?.focus(); }}
    >
      {/* Input row */}
      <div className="referrals-ai-search-row">
        <Search size={16} className="referrals-ai-search-icon" />

        {/* Input + animated placeholder */}
        <div className="referrals-ai-search-field">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setIsActive(true)}
            className="referrals-ai-search-input"
            autoComplete="off"
            spellCheck={false}
            aria-label="Search by company domain or name"
          />
          {/* Animated placeholder */}
          <AnimatePresence mode="wait">
            {showPlaceholder && !isActive && !value && (
              <motion.span
                key={placeholderIndex}
                className="referrals-ai-search-placeholder"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={{
                  initial: {},
                  animate: { transition: { staggerChildren: 0.025 } },
                  exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
                }}
              >
                {SEARCH_PLACEHOLDERS[placeholderIndex].split('').map((char, i) => (
                  <motion.span
                    key={i}
                    variants={placeholderLetterVariants}
                    style={{ display: 'inline-block' }}
                  >
                    {char === ' ' ? '\u00A0' : char}
                  </motion.span>
                ))}
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Send/Search button */}
        <button
          type="button"
          className="referrals-ai-search-send"
          disabled={isSearching || !value.trim()}
          onClick={e => { e.stopPropagation(); if (value.trim()) onSubmit(); }}
        >
          {isSearching
            ? <Loader2 size={16} className="referrals-spin" />
            : <Send size={16} />
          }
        </button>
      </div>

      {/* Expanded hint — only in non-compact (hero) mode */}
      {!compact && (
        <motion.div
          className="referrals-ai-search-hint"
          variants={{
            hidden: { opacity: 0, y: 10, pointerEvents: 'none' as const },
            visible: { opacity: 1, y: 0, pointerEvents: 'auto' as const, transition: { duration: 0.3, delay: 0.08 } },
          }}
          initial="hidden"
          animate={(isActive || value) ? 'visible' : 'hidden'}
        >
          <span>Enter a company URL - like google.com or stripe.com</span>
          <span className="referrals-ai-search-hint-kbd">↵ Search</span>
        </motion.div>
      )}
    </motion.div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export function ReferralsView() {
  const searchParams = useSearchParams();
  const initialDomain = searchParams.get('domain') ?? '';
  const sub = useSubscription();
  const linkedinLocked = isFeatureLocked('linkedinRetrieved', sub);
  const [liteModalOpen, setLiteModalOpen] = useState(false);
  const [limitModal, setLimitModal] = useState<{ feature: UsageFeature; resetDate: string | null } | null>(null);
  const [viewingLinkedinIds, setViewingLinkedinIds] = useState<Set<string>>(new Set());

  const [companyInput, setCompanyInput] = useState(initialDomain);
  const [isSearching, setIsSearching] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[] | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealResult>>({});
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());

  const [activeSeniorities, setActiveSeniorities] = useState<Set<string>>(new Set());
  const [activeCountries, setActiveCountries] = useState<Set<string>>(new Set());
  const [activeCities, setActiveCities] = useState<Set<string>>(new Set());

  // Auto-search when navigated here from a job detail with ?domain=
  useEffect(() => {
    if (initialDomain) {
      // Slight delay so the component fully mounts before the search runs
      const t = setTimeout(() => {
        handleSearch();
      }, 120);
      return () => clearTimeout(t);
    }
  // handleSearch is defined below — this effect must only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filterOptions = useMemo(() => {
    if (!allContacts) return null;
    const seniorities = allContacts.map(c => inferSeniority(c.title));
    const countries = allContacts.map(c => c.location?.country).filter((v): v is string => !!v);
    const cities = allContacts.map(c => c.location?.city).filter((v): v is string => !!v);
    return {
      seniority: buildCounts(seniorities),
      country: buildCounts(countries),
      city: buildCounts(cities),
    };
  }, [allContacts]);

  const filteredContacts = useMemo(() => {
    if (!allContacts) return [];
    return allContacts.filter(c => {
      if (activeSeniorities.size > 0 && !activeSeniorities.has(inferSeniority(c.title))) return false;
      if (activeCountries.size > 0 && !activeCountries.has(c.location?.country ?? '')) return false;
      if (activeCities.size > 0 && !activeCities.has(c.location?.city ?? '')) return false;
      return true;
    });
  }, [allContacts, activeSeniorities, activeCountries, activeCities]);

  const hasFilters = activeSeniorities.size > 0 || activeCountries.size > 0 || activeCities.size > 0;

  function clearFilters() {
    setActiveSeniorities(new Set());
    setActiveCountries(new Set());
    setActiveCities(new Set());
  }

  function toggleSet(set: Set<string>, value: string): Set<string> {
    const next = new Set(set);
    if (next.has(value)) next.delete(value); else next.add(value);
    return next;
  }

  async function handleSearch() {
    if (!companyInput.trim()) return;
    setIsSearching(true);
    setError(null);
    setAllContacts(null);
    clearFilters();

    const domain = extractDomain(companyInput.trim());

    try {
      const res = await fetch('/api/contacts/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyDomain: domain }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? `Search failed (${res.status})`);
      }
      const data = await res.json() as SearchResult;
      setAllContacts(data.contacts);
      setTotalEntries(data.totalEntries);

      // Pre-populate revealedMap for contacts whose emails are already stored in DB
      const preRevealed: Record<string, RevealResult> = {};
      for (const contact of data.contacts) {
        if (contact.email !== null) {
          preRevealed[contact.id] = {
            email: contact.email,
            emailStatus: contact.emailStatus,
            fromCache: true,
          };
        }
      }
      if (Object.keys(preRevealed).length > 0) {
        setRevealedMap(preRevealed);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  async function handleReveal(contactId: string) {
    if (revealingIds.has(contactId)) return;

    // Client-side pre-check (skip if sub still loading — server guard will enforce)
    if (!sub.isLoading) {
      if (sub.planType === 'LITE') { setLiteModalOpen(true); return; }
      if (sub.usage.emailsRetrieved >= sub.limits.emailsRetrieved) {
        setLimitModal({ feature: 'emailsRetrieved', resetDate: sub.currentPeriodEnd });
        return;
      }
    }

    setRevealingIds(prev => new Set(prev).add(contactId));
    try {
      const res = await fetch(`/api/contacts/${contactId}/reveal`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({})) as { error?: string; resetDate?: string };
          if (body.error === 'UNAUTHORIZED') { setLiteModalOpen(true); return; }
          setLimitModal({ feature: 'emailsRetrieved', resetDate: body.resetDate ?? null });
          return;
        }
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error ?? 'Failed to reveal');
      }
      const data = await res.json() as RevealResult;
      setRevealedMap(prev => ({ ...prev, [contactId]: data }));
    } catch (err) {
      console.error('[referrals] reveal error:', err);
    } finally {
      setRevealingIds(prev => { const n = new Set(prev); n.delete(contactId); return n; });
    }
  }

  async function handleLinkedinView(contactId: string, linkedinUrl: string) {
    if (viewingLinkedinIds.has(contactId)) return;

    // Client-side pre-check (skip if sub still loading — server guard will enforce)
    if (!sub.isLoading) {
      if (sub.planType === 'LITE') { setLiteModalOpen(true); return; }
      if (sub.usage.linkedinRetrieved >= sub.limits.linkedinRetrieved) {
        setLimitModal({ feature: 'linkedinRetrieved', resetDate: sub.currentPeriodEnd });
        return;
      }
    }

    setViewingLinkedinIds(prev => new Set(prev).add(contactId));
    try {
      const res = await fetch(`/api/contacts/${contactId}/linkedin-view`, { method: 'POST' });
      if (!res.ok) {
        if (res.status === 403) {
          const body = await res.json().catch(() => ({})) as { error?: string; resetDate?: string };
          if (body.error === 'UNAUTHORIZED') { setLiteModalOpen(true); return; }
          setLimitModal({ feature: 'linkedinRetrieved', resetDate: body.resetDate ?? null });
          return;
        }
        return;
      }
      window.open(linkedinUrl, '_blank', 'noopener,noreferrer');
    } finally {
      setViewingLinkedinIds(prev => { const n = new Set(prev); n.delete(contactId); return n; });
    }
  }

  const hasSearched = allContacts !== null || isSearching;
  void totalEntries;

  return (
    <div className="referrals-view">

      {/* ── Hero / Top search area ── */}
      <motion.div
        className="referrals-hero"
        initial={hasSearched ? 'compact' : 'hero'}
        animate={hasSearched ? 'compact' : 'hero'}
        variants={{
          hero: {
            paddingTop: '0px',
            paddingBottom: '0px',
            justifyContent: 'center',
          },
          compact: {
            paddingTop: '28px',
            paddingBottom: '0px',
            justifyContent: 'flex-start',
          },
        }}
        transition={{ type: 'spring', stiffness: 120, damping: 22 }}
      >
        {/* Title block (landing) */}
        <AnimatePresence>
          {!hasSearched && (
            <motion.div
              className="referrals-hero-text"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] } }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.3, ease: 'easeIn' } }}
            >
              <h1 className="referrals-hero-title">Find Referrals</h1>
              <p className="referrals-hero-subtitle">
                Get referred at any company - discover employees, unlock their emails, reach out and land the job.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Compact header (shown after search) */}
        <AnimatePresence>
          {hasSearched && (
            <motion.div
              className="referrals-compact-header"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1, transition: { delay: 0.15, duration: 0.3 } }}
              exit={{ opacity: 0 }}
            >
              <h1 className="referrals-compact-title">Find Referrals</h1>
              <p className="referrals-compact-subtitle">Discover and reach out to the employees who can refer you</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search bar — shared between hero and compact */}
        <div className="referrals-hero-search-wrap">
          <ReferralsSearchInput
            value={companyInput}
            onChange={setCompanyInput}
            onSubmit={handleSearch}
            isSearching={isSearching}
            compact={hasSearched}
          />
        </div>
      </motion.div>

      {/* ── Error bar ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="referrals-error-bar"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Results area ── */}
      <AnimatePresence>
        {hasSearched && (
          <motion.div
            className="referrals-results"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 } }}
            exit={{ opacity: 0, y: 16 }}
          >

            {/* Filter panel */}
            {filterOptions && allContacts && allContacts.length > 0 && (
              <div className="referrals-filter-panel">
                {Object.keys(filterOptions.seniority).length > 0 && (
                  <FilterDropdown
                    label="Seniority"
                    counts={filterOptions.seniority}
                    active={activeSeniorities}
                    onToggle={v => setActiveSeniorities(prev => toggleSet(prev, v))}
                    onClear={() => setActiveSeniorities(new Set())}
                  />
                )}
                {Object.keys(filterOptions.country).length > 0 && (
                  <FilterDropdown
                    label="Country"
                    counts={filterOptions.country}
                    active={activeCountries}
                    onToggle={v => setActiveCountries(prev => toggleSet(prev, v))}
                    onClear={() => setActiveCountries(new Set())}
                  />
                )}
                {Object.keys(filterOptions.city).length > 0 && (
                  <FilterDropdown
                    label="City"
                    counts={filterOptions.city}
                    active={activeCities}
                    onToggle={v => setActiveCities(prev => toggleSet(prev, v))}
                    onClear={() => setActiveCities(new Set())}
                  />
                )}
                {hasFilters && (
                  <button className="referrals-clear-all-filters" onClick={clearFilters}>
                    <X size={12} /> Clear All
                  </button>
                )}
              </div>
            )}

            {/* Skeleton */}
            {isSearching && (
              <div className="referrals-table-shell">
                <table className="referrals-table">
                  <thead>
                    <tr>
                      <th>Name</th><th>Title</th><th>Seniority</th>
                      <th>Location</th><th>LinkedIn</th><th>Email</th><th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <tr key={i} className="referrals-row">
                        <td><div className="referrals-person-cell"><div className="referrals-skel referrals-skel--avatar" /><div className="referrals-skel referrals-skel--name" /></div></td>
                        <td><div className="referrals-skel referrals-skel--text" /></td>
                        <td><div className="referrals-skel referrals-skel--badge" /></td>
                        <td><div className="referrals-skel referrals-skel--short" /></td>
                        <td><div className="referrals-skel referrals-skel--short" /></td>
                        <td><div className="referrals-skel referrals-skel--text" /></td>
                        <td><div className="referrals-skel referrals-skel--btn" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Results table */}
            {!isSearching && allContacts && (
              <>
                {allContacts.length === 0 ? (
                  <div className="referrals-no-results">
                    <Users size={24} strokeWidth={1.5} />
                    <p>No contacts found. Try a different domain or company name.</p>
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div className="referrals-no-results">
                    <Users size={24} strokeWidth={1.5} />
                    <p>No contacts match the selected filters.</p>
                    <button className="referrals-clear-filters" onClick={clearFilters}>
                      <X size={12} /> Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="referrals-table-shell">
                    <table className="referrals-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Title</th>
                          <th>Seniority</th>
                          <th>Location</th>
                          <th>LinkedIn</th>
                          <th>Email</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map(contact => {
                          const revealed = revealedMap[contact.id];
                          const isRevealing = revealingIds.has(contact.id);
                          const initials = getInitials(contact.firstName, contact.lastName);
                          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
                          const locationStr = [contact.location?.city, contact.location?.country].filter(Boolean).join(', ') || null;
                          const seniority = inferSeniority(contact.title);
                          const badgeClass = SENIORITY_BADGE_CLASS[seniority] ?? 'referrals-seniority-badge--other';
                          // revealed !== undefined means the reveal was attempted (email may still be null if not found)
                          const hasAttempted = revealed !== undefined;
                          const isRevealed = hasAttempted && revealed.email !== null;

                          return (
                            <tr key={contact.id} className="referrals-row">
                              <td>
                                <div className="referrals-person-cell">
                                  <div className="referrals-avatar" style={{ background: getAvatarColor(initials) }}>{initials}</div>
                                  <span className="referrals-person-name">{fullName}</span>
                                </div>
                              </td>
                              <td>
                                <div className="referrals-title-cell">
                                  <span className="referrals-title-primary">{contact.title || '—'}</span>
                                  {contact.companyDomain && <span className="referrals-title-company">{contact.companyDomain}</span>}
                                </div>
                              </td>
                              <td>
                                <span className={`referrals-seniority-badge ${badgeClass}`}>{seniority}</span>
                              </td>
                              <td>
                                {locationStr ? (
                                  <div className="referrals-location-cell">
                                    <MapPin size={12} className="referrals-location-icon" />
                                    {locationStr}
                                  </div>
                                ) : <span className="referrals-empty-cell">—</span>}
                              </td>
                              <td>
                                {contact.linkedinUrl ? (
                                  linkedinLocked ? (
                                    <button
                                      type="button"
                                      className="referrals-linkedin-btn referrals-linkedin-btn--locked"
                                      onClick={() => {
                                        if (sub.planType === 'LITE') { setLiteModalOpen(true); return; }
                                        setLimitModal({ feature: 'linkedinRetrieved', resetDate: sub.currentPeriodEnd });
                                      }}
                                    >
                                      <Image src={LINKEDIN_LOGO_SRC} alt="" width={14} height={14} className="referrals-linkedin-logo" style={{ opacity: 0.4 }} />
                                      <Lock size={11} strokeWidth={2} />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      className="referrals-linkedin-btn"
                                      onClick={() => handleLinkedinView(contact.id, contact.linkedinUrl!)}
                                      disabled={viewingLinkedinIds.has(contact.id)}
                                    >
                                      {viewingLinkedinIds.has(contact.id) ? (
                                        <Loader2 size={12} className="referrals-spin" />
                                      ) : (
                                        <Image src={LINKEDIN_LOGO_SRC} alt="" width={14} height={14} className="referrals-linkedin-logo" />
                                      )}
                                      View
                                    </button>
                                  )
                                ) : <span className="referrals-empty-cell">—</span>}
                              </td>
                              <td>
                                {isRevealed ? (
                                  <div className="referrals-email-revealed">
                                    <Mail size={12} strokeWidth={2} />
                                    <span>{revealed.email}</span>
                                    {revealed.emailStatus === 'VALID' && <span className="referrals-verified-dot" title="Valid" />}
                                  </div>
                                ) : hasAttempted ? (
                                  <div className="referrals-email-not-found">
                                    <Lock size={11} strokeWidth={2} />
                                    <span>Not available</span>
                                  </div>
                                ) : (
                                  <div className="referrals-email-locked">
                                    <Lock size={11} strokeWidth={2} />
                                    <span className="referrals-blur-text">j.doe@company.com</span>
                                  </div>
                                )}
                              </td>
                              <td>
                                <div className={`referrals-action-cell ${(isRevealed || hasAttempted) ? 'referrals-action-cell--revealed' : ''}`}>
                                  {isRevealed ? (
                                    <span className="referrals-revealed-tag"><Eye size={12} strokeWidth={2} />Revealed</span>
                                  ) : hasAttempted ? (
                                    <span className="referrals-not-found-tag">Not found</span>
                                  ) : (
                                    <button className="referrals-reveal-btn" onClick={() => handleReveal(contact.id)} disabled={isRevealing}>
                                      {isRevealing ? <Loader2 size={12} className="referrals-spin" /> : <Eye size={12} strokeWidth={2} />}
                                      {isRevealing ? 'Loading…' : 'Reveal Email'}
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="referrals-table-footer">
                      <span className="referrals-table-footer-label">
                        Showing {filteredContacts.length}{hasFilters ? ` of ${allContacts.length}` : ''} contacts
                      </span>
                    </div>
                  </div>
                )}
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <LiteUpgradeModal open={liteModalOpen} onClose={() => setLiteModalOpen(false)} />
      {sub.planType === 'CAPTAIN' ? (
        <CaptainLimitModal
          open={!!limitModal}
          onClose={() => setLimitModal(null)}
          resetDate={limitModal?.resetDate ?? null}
        />
      ) : (
        <LimitReachedModal
          open={!!limitModal}
          onClose={() => setLimitModal(null)}
          feature={limitModal?.feature ?? 'emailsRetrieved'}
          resetDate={limitModal?.resetDate ?? null}
        />
      )}
    </div>
  );
}

// ── FilterDropdown ─────────────────────────────────────────────────────────

function FilterDropdown({
  label,
  counts,
  active,
  onToggle,
  onClear,
}: {
  label: string;
  counts: Record<string, number>;
  active: Set<string>;
  onToggle: (value: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const activeCount = active.size;
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  if (entries.length === 0) return null;

  return (
    <div className="referrals-dropdown-wrap" ref={ref}>
      <button
        className={`referrals-dropdown-pill ${activeCount > 0 ? 'referrals-dropdown-pill--active' : ''}`}
        onClick={() => setOpen(v => !v)}
        type="button"
      >
        {label}
        {activeCount > 0 && <span className="referrals-dropdown-pill-count">{activeCount}</span>}
        <ChevronDown size={13} className={`referrals-dropdown-chevron ${open ? 'referrals-dropdown-chevron--open' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            className="referrals-dropdown-panel"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1, transition: { duration: 0.15, ease: 'easeOut' } }}
            exit={{ opacity: 0, y: -4, scale: 0.97, transition: { duration: 0.1 } }}
          >
            <div className="referrals-dropdown-chips">
              {entries.map(([value, count]) => (
                <button
                  key={value}
                  type="button"
                  className={`referrals-filter-chip ${active.has(value) ? 'referrals-filter-chip--active' : ''}`}
                  onClick={() => onToggle(value)}
                >
                  {value}
                  <span className="referrals-filter-chip-count">{count}</span>
                </button>
              ))}
            </div>
            {activeCount > 0 && (
              <button type="button" className="referrals-dropdown-clear" onClick={() => { onClear(); setOpen(false); }}>
                <X size={11} /> Clear {label}
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
