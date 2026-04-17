# Referrals Client-Side Filtering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Prospeo pre-search filters with a fetch-all-then-filter-client-side model: single company input, fetch up to 75 contacts, dynamic filter chips from actual results, zero API errors visible to users.

**Architecture:** Backend fetches up to 3 pages (25 each) from Prospeo with no filters — just the company domain. Results are cached by domain only (7-day TTL). Frontend receives the full flat list and builds filter options from it; all narrowing is pure React state with no extra API calls.

**Tech Stack:** Next.js 16, TypeScript, Prisma, Prospeo API, Vitest, React, CSS variables (existing design system)

---

## File Map

| File | Change |
|---|---|
| `src/lib/contacts/query-hash.ts` | Simplify `SearchParams` to `{ companyDomain: string }` |
| `src/lib/contacts/prospeo-client.ts` | Remove filter params; `searchPeople(domain, page)` only |
| `src/lib/contacts/search-contacts.ts` | Multi-page fetch loop; JSON-encode location; richer result type |
| `src/app/api/contacts/search/route.ts` | Accept only `companyDomain` |
| `src/components/layout/ReferralsView.tsx` | Full rewrite — single input, dynamic filters, updated columns |
| `src/app/globals.css` | Filter chip styles |
| `tests/contacts/query-hash.test.ts` | Update for new `SearchParams` shape |
| `tests/contacts/search-contacts.test.ts` | Update for multi-page fetch and new result shape |

---

## Task 1: Simplify SearchParams and query-hash

**Files:**
- Modify: `src/lib/contacts/query-hash.ts`
- Modify: `tests/contacts/query-hash.test.ts`

- [ ] **Step 1: Update the test file to match the new SearchParams shape**

Replace the full contents of `tests/contacts/query-hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildQueryHash } from '@/lib/contacts/query-hash';

describe('buildQueryHash', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = buildQueryHash({ companyDomain: 'stripe.com' });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('is deterministic for the same domain', () => {
    const params = { companyDomain: 'stripe.com' };
    expect(buildQueryHash(params)).toBe(buildQueryHash(params));
  });

  it('differs when companyDomain changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com' });
    const b = buildQueryHash({ companyDomain: 'openai.com' });
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails (function signature mismatch)**

```
npx vitest run tests/contacts/query-hash.test.ts
```

Expected: FAIL — `buildQueryHash` expects extra params that no longer exist in the test.

- [ ] **Step 3: Replace query-hash.ts**

```typescript
import { createHash } from 'crypto';

export interface SearchParams {
  companyDomain: string;
}

export function buildQueryHash(params: SearchParams): string {
  return createHash('sha256').update(params.companyDomain.toLowerCase()).digest('hex');
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
npx vitest run tests/contacts/query-hash.test.ts
```

Expected: 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/query-hash.ts tests/contacts/query-hash.test.ts
git commit -m "refactor(contacts): simplify SearchParams to domain-only"
```

---

## Task 2: Remove filter params from Prospeo client

**Files:**
- Modify: `src/lib/contacts/prospeo-client.ts`

No test changes needed — the existing apollo-client tests don't cover prospeo-client, and the prospeo client behaviour (domain filter only) will be exercised via the search-contacts tests in Task 3.

- [ ] **Step 1: Replace `ProspeoSearchParams` and `searchPeople` in prospeo-client.ts**

Change lines 53–113 of `src/lib/contacts/prospeo-client.ts`. Replace `ProspeoSearchParams` interface and `searchPeople` function with:

```typescript
export interface ProspeoSearchParams {
  companyDomain: string;
  page: number;
}

// ── Search Person ──────────────────────────────────────────────────────────

export async function searchPeople(params: ProspeoSearchParams): Promise<ProspeoSearchResponse> {
  const key = getApiKey();

  try {
    const { data } = await axios.post(
      `${PROSPEO_BASE}/search-person`,
      {
        page: params.page,
        filters: {
          company: { websites: { include: [params.companyDomain] } },
        },
      },
      { headers: headers(key) },
    );

    const payload = data as {
      error: boolean;
      results?: Array<{ person: ProspeoPersonResult; company: unknown }>;
      pagination?: { total_count: number };
    };

    if (payload.error) throw new ProspeoServiceError('Prospeo returned an error response');

    return {
      results: (payload.results ?? []).map(r => r.person),
      total: payload.pagination?.total_count ?? 0,
    };
  } catch (err) {
    if ((err as { name?: string })?.name?.startsWith('Prospeo')) throw err;
    handleError(err);
  }
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/contacts/prospeo-client.ts
git commit -m "refactor(contacts): remove filter params from Prospeo searchPeople"
```

---

## Task 3: Multi-page fetch and richer ContactSearchResult

**Files:**
- Modify: `src/lib/contacts/search-contacts.ts`
- Modify: `tests/contacts/search-contacts.test.ts`

Key changes:
- `ContactSearchResult` gains `location: { city: string | null; country: string | null } | null` and drops `companyName` and `page`.
- `SearchContactsResponse` drops `page`.
- Location stored in DB as `JSON.stringify({ city, country })` — existing plain-string rows fall back gracefully.
- Multi-page loop: fetch pages 1→2→3, stop early if page returns < 25 results.
- Any `ProspeoServiceError` mid-fetch is caught and logged; accumulated results are returned.
- Auth/rate-limit errors still propagate (they're fatal).

- [ ] **Step 1: Update the test file**

Replace the full contents of `tests/contacts/search-contacts.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contactSearchCache: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

vi.mock('@/lib/contacts/prospeo-client', () => ({
  searchPeople: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { searchPeople } from '@/lib/contacts/prospeo-client';
import { searchContacts } from '@/lib/contacts/search-contacts';

const mockPrisma = vi.mocked(prisma, true);
const mockSearchPeople = vi.mocked(searchPeople);

const PARAMS = { companyDomain: 'stripe.com' };

const PROSPEO_PERSON = {
  person_id: 'p-1',
  first_name: 'Jane',
  last_name: 'Doe',
  full_name: 'Jane Doe',
  linkedin_url: 'https://linkedin.com/in/janedoe',
  current_job_title: 'Senior Engineer',
  headline: 'Building things at Stripe',
  location: { city: 'San Francisco', country: 'US' },
};

const DB_CONTACT = {
  id: 'uuid-1',
  apolloId: 'prospeo:p-1',
  firstName: 'Jane',
  lastName: 'Doe',
  title: 'Senior Engineer',
  companyName: null,
  companyDomain: 'stripe.com',
  linkedinUrl: 'https://linkedin.com/in/janedoe',
  location: JSON.stringify({ city: 'San Francisco', country: 'US' }),
  email: null,
  emailStatus: null,
  emailRevealedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe('searchContacts — cache HIT', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contactSearchCache.findFirst = vi.fn().mockResolvedValue({
      queryHash: 'hash',
      totalEntries: 1,
      contactApolloIds: ['prospeo:p-1'],
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([DB_CONTACT]);
  });

  it('returns cached contacts without calling Prospeo', async () => {
    const result = await searchContacts(PARAMS);
    expect(mockSearchPeople).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].firstName).toBe('Jane');
    expect(result.contacts[0].emailRevealed).toBe(false);
    expect(result.contacts[0].location?.country).toBe('US');
  });

  it('returns emailRevealed: true when contact has an email', async () => {
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([
      { ...DB_CONTACT, email: 'jane@stripe.com' },
    ]);
    const result = await searchContacts(PARAMS);
    expect(result.contacts[0].emailRevealed).toBe(true);
  });
});

describe('searchContacts — cache MISS, single page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contactSearchCache.findFirst = vi.fn().mockResolvedValue(null);
    mockSearchPeople.mockResolvedValue({ results: [PROSPEO_PERSON], total: 1 });
    mockPrisma.contact.upsert = vi.fn().mockResolvedValue(DB_CONTACT);
    mockPrisma.contactSearchCache.create = vi.fn().mockResolvedValue({});
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([DB_CONTACT]);
  });

  it('calls Prospeo page 1 only when result < 25', async () => {
    const result = await searchContacts(PARAMS);
    expect(mockSearchPeople).toHaveBeenCalledTimes(1);
    expect(mockSearchPeople).toHaveBeenCalledWith({ companyDomain: 'stripe.com', page: 1 });
    expect(result.cached).toBe(false);
    expect(result.contacts[0].location?.city).toBe('San Francisco');
  });

  it('upserts with JSON-encoded location', async () => {
    await searchContacts(PARAMS);
    expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { apolloId: 'prospeo:p-1' },
        create: expect.objectContaining({
          location: JSON.stringify({ city: 'San Francisco', country: 'US' }),
        }),
      })
    );
  });

  it('writes cache with 7-day expiry', async () => {
    await searchContacts(PARAMS);
    const call = vi.mocked(mockPrisma.contactSearchCache.create).mock.calls[0][0];
    const expiresAt: Date = (call as { data: { expiresAt: Date } }).data.expiresAt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5000);
  });
});

describe('searchContacts — cache MISS, multi-page', () => {
  const full25 = Array.from({ length: 25 }, (_, i) => ({
    ...PROSPEO_PERSON,
    person_id: `p-${i}`,
  }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contactSearchCache.findFirst = vi.fn().mockResolvedValue(null);
    mockPrisma.contact.upsert = vi.fn().mockResolvedValue(DB_CONTACT);
    mockPrisma.contactSearchCache.create = vi.fn().mockResolvedValue({});
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([DB_CONTACT]);
  });

  it('fetches page 2 when page 1 returns exactly 25 results', async () => {
    mockSearchPeople
      .mockResolvedValueOnce({ results: full25, total: 30 })
      .mockResolvedValueOnce({ results: [PROSPEO_PERSON], total: 30 });

    await searchContacts(PARAMS);
    expect(mockSearchPeople).toHaveBeenCalledTimes(2);
    expect(mockSearchPeople).toHaveBeenNthCalledWith(2, { companyDomain: 'stripe.com', page: 2 });
  });

  it('stops at 3 pages even if page 3 returns 25', async () => {
    mockSearchPeople.mockResolvedValue({ results: full25, total: 200 });
    await searchContacts(PARAMS);
    expect(mockSearchPeople).toHaveBeenCalledTimes(3);
  });

  it('returns partial results when mid-fetch ProspeoServiceError occurs', async () => {
    const { ProspeoServiceError } = await import('@/lib/contacts/prospeo-client');
    mockSearchPeople
      .mockResolvedValueOnce({ results: full25, total: 50 })
      .mockRejectedValueOnce(new ProspeoServiceError('boom'));

    const result = await searchContacts(PARAMS);
    expect(result.contacts).toHaveLength(1); // only page-1 contacts from DB (mocked findMany returns 1)
    expect(result.cached).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (implementation not updated yet)**

```
npx vitest run tests/contacts/search-contacts.test.ts
```

Expected: FAIL — several tests fail due to old implementation.

- [ ] **Step 3: Replace search-contacts.ts**

```typescript
import { prisma } from '@/lib/prisma';
import { searchPeople, ProspeoAuthError, ProspeoRateLimitError } from './prospeo-client';
import { buildQueryHash, type SearchParams } from './query-hash';

export interface ContactSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
  location: { city: string | null; country: string | null } | null;
}

export interface SearchContactsResponse {
  contacts: ContactSearchResult[];
  totalEntries: number;
  cached: boolean;
}

const MAX_PAGES = 3;
const PAGE_SIZE = 25;

function encodeLocation(city: string | null, country: string | null): string | null {
  if (!city && !country) return null;
  return JSON.stringify({ city, country });
}

function decodeLocation(raw: string | null): { city: string | null; country: string | null } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { city: string | null; country: string | null };
  } catch {
    return { city: raw, country: null }; // legacy plain-string fallback
  }
}

export async function searchContacts(params: SearchParams): Promise<SearchContactsResponse> {
  const queryHash = buildQueryHash(params);

  const cache = await prisma.contactSearchCache.findFirst({
    where: { queryHash, expiresAt: { gt: new Date() } },
  });

  if (cache) {
    const providerIds = cache.contactApolloIds as string[];
    const contacts = await prisma.contact.findMany({ where: { apolloId: { in: providerIds } } });
    return { contacts: contacts.map(toSearchResult), totalEntries: cache.totalEntries ?? 0, cached: true };
  }

  // Multi-page fetch — stop early if a page has < PAGE_SIZE results
  const providerIds: string[] = [];
  let totalEntries = 0;

  for (let page = 1; page <= MAX_PAGES; page++) {
    let pageResult;
    try {
      pageResult = await searchPeople({ companyDomain: params.companyDomain, page });
    } catch (err) {
      // Fatal errors re-throw; service errors stop the loop and return what we have
      if (err instanceof ProspeoAuthError || err instanceof ProspeoRateLimitError) throw err;
      console.error(`[search-contacts] Prospeo error on page ${page}, stopping:`, err);
      break;
    }

    totalEntries = pageResult.total;

    for (const person of pageResult.results) {
      const pid = `prospeo:${person.person_id}`;
      const locationJson = encodeLocation(
        person.location?.city ?? null,
        person.location?.country ?? null,
      );
      await prisma.contact.upsert({
        where: { apolloId: pid },
        create: {
          apolloId: pid,
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.current_job_title,
          companyName: null,
          companyDomain: params.companyDomain,
          linkedinUrl: person.linkedin_url,
          location: locationJson,
        },
        update: {
          firstName: person.first_name,
          lastName: person.last_name,
          title: person.current_job_title,
          linkedinUrl: person.linkedin_url,
          location: locationJson,
        },
      });
      providerIds.push(pid);
    }

    if (pageResult.results.length < PAGE_SIZE) break;
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.contactSearchCache.create({
    data: {
      queryHash,
      companyDomain: params.companyDomain,
      jobFunction: null,
      managementLevel: null,
      country: null,
      page: 1,
      totalEntries,
      contactApolloIds: providerIds,
      expiresAt,
    },
  });

  const contacts = await prisma.contact.findMany({ where: { apolloId: { in: providerIds } } });
  return { contacts: contacts.map(toSearchResult), totalEntries, cached: false };
}

function toSearchResult(c: {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  email: string | null;
  location: string | null;
}): ContactSearchResult {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    companyDomain: c.companyDomain,
    linkedinUrl: c.linkedinUrl,
    emailRevealed: c.email !== null,
    location: decodeLocation(c.location),
  };
}
```

- [ ] **Step 4: Run tests — expect PASS**

```
npx vitest run tests/contacts/search-contacts.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/contacts/search-contacts.ts tests/contacts/search-contacts.test.ts
git commit -m "feat(contacts): multi-page Prospeo fetch, JSON location, domain-only cache key"
```

---

## Task 4: Simplify the search API route

**Files:**
- Modify: `src/app/api/contacts/search/route.ts`

- [ ] **Step 1: Replace route.ts**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchContacts } from '@/lib/contacts/search-contacts';
import {
  ProspeoAuthError,
  ProspeoRateLimitError,
  ProspeoServiceError,
} from '@/lib/contacts/prospeo-client';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyDomain } = body as { companyDomain?: string };

  if (!companyDomain?.trim()) {
    return NextResponse.json({ error: 'companyDomain is required' }, { status: 400 });
  }

  try {
    const result = await searchContacts({ companyDomain: companyDomain.trim() });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProspeoAuthError) return NextResponse.json({ error: 'Prospeo API key error: ' + (err as Error).message }, { status: 500 });
    if (err instanceof ProspeoRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ProspeoServiceError) return NextResponse.json({ error: 'Prospeo service unavailable' }, { status: 502 });
    console.error('[contacts/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contacts/search/route.ts
git commit -m "refactor(contacts): search route accepts companyDomain only"
```

---

## Task 5: Rewrite ReferralsView with client-side filters

**Files:**
- Modify: `src/components/layout/ReferralsView.tsx`

This is a full replacement. Key design:
- Single text input for company name or URL (domain extraction is unchanged).
- After results load: filter chip panel appears above table.
- `inferSeniority(title)` parses seniority from job title string.
- Filter state is three `Set<string>` values; filtering is a `useMemo` over all contacts.
- Counts on chips reflect the full unfiltered result set.
- Table gains a **Location** column; **Company** column removed (it's always the searched domain).
- Two distinct empty states: API returned nothing vs. filters reduced to nothing.
- No pagination UI.

- [ ] **Step 1: Replace ReferralsView.tsx**

```typescript
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

  // Filter state — sets for OR-within-group, AND-across-groups
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
```

- [ ] **Step 2: Type-check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/ReferralsView.tsx
git commit -m "feat(referrals): single input, client-side filters, location column"
```

---

## Task 6: Add CSS for filter chips and updated search panel

**Files:**
- Modify: `src/app/globals.css`

Find the comment `/* ===== REFERRALS VIEW =====` in globals.css. Add the following CSS **before** the `/* ===== PRINT STYLES =====` comment (append to the existing referrals block).

- [ ] **Step 1: Add these CSS rules at the end of the referrals section in globals.css**

```css
/* Search panel — simplified single-input layout */
.referrals-search-panel--simple {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  flex-wrap: nowrap;
}

.referrals-input-wrap--full {
  flex: 1;
}

/* Filter panel */
.referrals-filter-panel {
  padding: 12px 24px;
  border-bottom: 1px solid var(--border);
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: flex-start;
  background: var(--background);
  flex-shrink: 0;
}

.referrals-filter-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.referrals-filter-group-label {
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.6px;
  color: var(--text-tertiary);
}

.referrals-filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.referrals-filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid var(--border);
  border-radius: 100px;
  background: var(--surface);
  color: var(--text-secondary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition-fast);
  white-space: nowrap;
}

.referrals-filter-chip:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.referrals-filter-chip--active {
  background: var(--accent-muted);
  border-color: var(--accent);
  color: var(--accent);
  font-weight: 600;
}

.referrals-filter-chip-count {
  font-size: 10.5px;
  font-weight: 700;
  opacity: 0.75;
}

.referrals-clear-filters {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: var(--radius-sm);
  align-self: flex-end;
  margin-bottom: 2px;
  transition: color var(--transition-fast);
}

.referrals-clear-filters:hover {
  color: var(--error);
}

.referrals-clear-filters--standalone {
  margin-top: 10px;
}

/* Location cell */
.referrals-location-cell {
  display: flex;
  align-items: center;
  gap: 5px;
}

.referrals-location-icon {
  color: var(--text-muted);
  flex-shrink: 0;
}
```

- [ ] **Step 2: Verify the dev server renders correctly**

Start the dev server (`npm run dev`) and open `http://localhost:3000/find-referrals`. Confirm:
- Search form shows only one input field and a search button.
- Searching a company (e.g. `stripe.com`) loads up to 75 contacts.
- Filter chips appear above the table after results load.
- Each chip shows a count.
- Selecting chips narrows the table.
- "Clear filters" appears when any filter is active.
- Empty company returns an empty-state message, no error toast.
- Location column shows city, Country.

- [ ] **Step 3: Commit**

```bash
git add src/app/globals.css
git commit -m "feat(referrals): filter chip styles and location cell"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Single company input (Task 5)
- ✅ Fetch up to 75 contacts, 3 pages (Task 3)
- ✅ Domain-only cache key (Task 3)
- ✅ Mid-fetch error → return partial results, no 502 (Task 3)
- ✅ Dynamic filter panel built from results (Task 5)
- ✅ Counts on each filter chip (Task 5, Task 6)
- ✅ AND-across-groups, OR-within-group filter logic (Task 5)
- ✅ Clear filters link (Task 5)
- ✅ Worldwide country list from results (Task 5 — derived from data, not hardcoded)
- ✅ Location column added (Task 5)
- ✅ Empty state for no API results (Task 5)
- ✅ Empty state for filter-narrowed-to-nothing (Task 5)
- ✅ Pagination removed (Task 5)
- ✅ Tests updated (Tasks 1, 3)
- ✅ CSS added (Task 6)
- ✅ `companyName` removed from `ContactSearchResult` (no longer null-always field) (Task 3)

**Placeholder scan:** No TBDs, no "similar to Task N", all code blocks are complete.

**Type consistency:** `ContactSearchResult.location` is `{ city, country } | null` — used consistently across `search-contacts.ts`, `ReferralsView.tsx` Contact interface, and the decode helper.
