'use client';

import React, { useState, useMemo } from 'react';
import {
  Search, Users, Mail, Linkedin, Lock, Eye, Loader2, MapPin, X,
} from 'lucide-react';

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

// ── Component ──────────────────────────────────────────────────────────────

export function ReferralsView() {
  const [companyInput, setCompanyInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [allContacts, setAllContacts] = useState<Contact[] | null>(null);
  const [totalEntries, setTotalEntries] = useState(0);
  const [isCached, setIsCached] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revealedMap, setRevealedMap] = useState<Record<string, RevealResult>>({});
  const [revealingIds, setRevealingIds] = useState<Set<string>>(new Set());

  const [activeSeniorities, setActiveSeniorities] = useState<Set<string>>(new Set());
  const [activeCountries, setActiveCountries] = useState<Set<string>>(new Set());
  const [activeCities, setActiveCities] = useState<Set<string>>(new Set());

  // ── Filter options derived from full result set ──
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

  // ── Filtered display list ──
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

  // ── Search ──
  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
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
      setIsCached(data.cached);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed. Please try again.');
    } finally {
      setIsSearching(false);
    }
  }

  // ── Reveal ──
  async function handleReveal(contactId: string) {
    if (revealingIds.has(contactId)) return;
    setRevealingIds(prev => new Set(prev).add(contactId));
    try {
      const res = await fetch(`/api/contacts/${contactId}/reveal`, { method: 'POST' });
      if (!res.ok) {
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

  const hasSearched = allContacts !== null;
  void totalEntries;

  // ── Render ──
  return (
    <div className="referrals-view">

      {/* Header */}
      <div className="referrals-header">
        <div className="referrals-header-inner">
          <div className="referrals-heading-block">
            <div className="referrals-heading-icon"><Users size={16} strokeWidth={2.5} /></div>
            <div>
              <h1 className="referrals-heading">Find Referrals</h1>
              <p className="referrals-heading-sub">Discover professionals at any company who can refer you</p>
            </div>
          </div>
          {hasSearched && allContacts && (
            <div className="referrals-header-meta">
              <span className="referrals-count-pill">{allContacts.length} contacts loaded</span>
              {isCached && <span className="referrals-cached-pill">cached</span>}
            </div>
          )}
        </div>
      </div>

      {/* Search form — single input */}
      <form onSubmit={handleSearch} className="referrals-search-panel referrals-search-panel--simple">
        <div className="referrals-input-wrap referrals-input-wrap--full">
          <Search size={14} className="referrals-input-prefix-icon" />
          <input
            type="text"
            className="referrals-input"
            placeholder="Company name or URL — e.g. stripe, zerodha.com, https://google.com"
            value={companyInput}
            onChange={e => setCompanyInput(e.target.value)}
            required
          />
        </div>
        <button
          type="submit"
          className="referrals-search-btn"
          disabled={isSearching || !companyInput.trim()}
        >
          {isSearching ? <Loader2 size={14} className="referrals-spin" /> : <Search size={14} strokeWidth={2.5} />}
          {isSearching ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* Error bar */}
      {error && <div className="referrals-error-bar">{error}</div>}

      {/* Body */}
      <div className="referrals-body">

        {/* Landing state */}
        {!hasSearched && !isSearching && (
          <div className="referrals-landing">
            <div className="referrals-landing-graphic"><Users size={28} strokeWidth={1.5} /></div>
            <h2 className="referrals-landing-title">Search for professionals</h2>
            <p className="referrals-landing-desc">
              Enter a company name or URL to find up to 75 contacts. Filter by seniority, country, or city once results load — no extra API calls needed.
            </p>
            <div className="referrals-landing-chips">
              <span className="referrals-chip"><Search size={12} /> Type any company name or URL</span>
              <span className="referrals-chip"><Eye size={12} /> Filter results client-side</span>
              <span className="referrals-chip"><Mail size={12} /> Reveal emails on demand</span>
            </div>
          </div>
        )}

        {/* Skeleton */}
        {isSearching && (
          <div className="referrals-table-shell">
            <table className="referrals-table">
              <thead>
                <tr><th>Person</th><th>Title</th><th>Location</th><th>LinkedIn</th><th>Email</th><th></th></tr>
              </thead>
              <tbody>
                {Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="referrals-row">
                    <td><div className="referrals-person-cell"><div className="referrals-skel referrals-skel--avatar" /><div className="referrals-skel referrals-skel--name" /></div></td>
                    <td><div className="referrals-skel referrals-skel--text" /></td>
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

        {/* Results */}
        {hasSearched && !isSearching && allContacts && (
          <>
            {allContacts.length === 0 ? (
              <div className="referrals-no-results">
                <Users size={24} strokeWidth={1.5} />
                <p>No contacts found for this company. Try a different domain or company name.</p>
              </div>
            ) : (
              <>
                {/* Filter chip panel */}
                {filterOptions && (
                  <div className="referrals-filter-panel">
                    <FilterGroup
                      label="Seniority"
                      counts={filterOptions.seniority}
                      active={activeSeniorities}
                      onToggle={v => setActiveSeniorities(prev => toggleSet(prev, v))}
                    />
                    <FilterGroup
                      label="Country"
                      counts={filterOptions.country}
                      active={activeCountries}
                      onToggle={v => setActiveCountries(prev => toggleSet(prev, v))}
                    />
                    <FilterGroup
                      label="City"
                      counts={filterOptions.city}
                      active={activeCities}
                      onToggle={v => setActiveCities(prev => toggleSet(prev, v))}
                    />
                    {hasFilters && (
                      <button className="referrals-clear-filters" onClick={clearFilters}>
                        <X size={12} /> Clear filters
                      </button>
                    )}
                  </div>
                )}

                {/* Table or filter-empty state */}
                {filteredContacts.length === 0 ? (
                  <div className="referrals-no-results">
                    <Users size={24} strokeWidth={1.5} />
                    <p>No contacts match the selected filters.</p>
                    <button className="referrals-clear-filters referrals-clear-filters--standalone" onClick={clearFilters}>
                      <X size={12} /> Clear filters
                    </button>
                  </div>
                ) : (
                  <div className="referrals-table-shell">
                    <table className="referrals-table">
                      <thead>
                        <tr>
                          <th>Person</th>
                          <th>Title</th>
                          <th>Location</th>
                          <th>LinkedIn</th>
                          <th>Email</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredContacts.map(contact => {
                          const revealed = revealedMap[contact.id];
                          const isRevealing = revealingIds.has(contact.id);
                          const initials = getInitials(contact.firstName, contact.lastName);
                          const fullName = [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Unknown';
                          const locationStr = [contact.location?.city, contact.location?.country].filter(Boolean).join(', ') || '—';

                          return (
                            <tr key={contact.id} className="referrals-row">
                              <td>
                                <div className="referrals-person-cell">
                                  <div className="referrals-avatar" style={{ background: getAvatarColor(initials) }}>{initials}</div>
                                  <span className="referrals-person-name">{fullName}</span>
                                </div>
                              </td>
                              <td><span className="referrals-cell-secondary">{contact.title || '—'}</span></td>
                              <td>
                                <div className="referrals-location-cell">
                                  {locationStr !== '—' && <MapPin size={12} className="referrals-location-icon" />}
                                  <span className="referrals-cell-secondary">{locationStr}</span>
                                </div>
                              </td>
                              <td>
                                {contact.linkedinUrl ? (
                                  <a href={contact.linkedinUrl} target="_blank" rel="noopener noreferrer" className="referrals-linkedin-btn">
                                    <Linkedin size={13} strokeWidth={2} />View
                                  </a>
                                ) : (
                                  <span className="referrals-empty-cell">—</span>
                                )}
                              </td>
                              <td>
                                {revealed?.email ? (
                                  <div className="referrals-email-revealed">
                                    <Mail size={13} strokeWidth={2} />
                                    <span>{revealed.email}</span>
                                    {revealed.emailStatus === 'VALID' && <span className="referrals-verified-dot" title="Valid" />}
                                  </div>
                                ) : (
                                  <div className="referrals-email-locked">
                                    <Lock size={12} strokeWidth={2} />
                                    <span className="referrals-blur-text">j.doe@company.com</span>
                                  </div>
                                )}
                              </td>
                              <td>
                                {revealed?.email ? (
                                  <span className="referrals-revealed-tag"><Eye size={12} strokeWidth={2} />Revealed</span>
                                ) : (
                                  <button className="referrals-reveal-btn" onClick={() => handleReveal(contact.id)} disabled={isRevealing}>
                                    {isRevealing ? <Loader2 size={12} className="referrals-spin" /> : <Eye size={12} strokeWidth={2} />}
                                    {isRevealing ? 'Loading…' : 'Reveal Email'}
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
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── FilterGroup sub-component ──────────────────────────────────────────────

function FilterGroup({
  label,
  counts,
  active,
  onToggle,
}: {
  label: string;
  counts: Record<string, number>;
  active: Set<string>;
  onToggle: (value: string) => void;
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return null;

  return (
    <div className="referrals-filter-group">
      <span className="referrals-filter-group-label">{label}</span>
      <div className="referrals-filter-chips">
        {entries.map(([value, count]) => (
          <button
            key={value}
            className={`referrals-filter-chip ${active.has(value) ? 'referrals-filter-chip--active' : ''}`}
            onClick={() => onToggle(value)}
          >
            {value}
            <span className="referrals-filter-chip-count">{count}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
