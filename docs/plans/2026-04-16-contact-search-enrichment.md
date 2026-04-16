# Contact Search & Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend Contact Search & Enrichment feature that finds employees via Apollo.io, caches results in PostgreSQL, and reveals emails on demand — all without a user-facing billing system yet.

**Architecture:** Flat lib modules under `src/lib/contacts/` (matching the existing `auto-apply` pattern) backed by three new Prisma models. Two Next.js route handlers expose the search and reveal endpoints. Apollo is called only on cache misses; revealed emails are stored permanently and shared across all users.

**Tech Stack:** Next.js 16 App Router, TypeScript, Prisma 5, PostgreSQL (Neon), Axios, Clerk auth, Vitest

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `Contact`, `ContactSearchCache`, `ContactReveal` models; add relation to `User` |
| `src/lib/contacts/query-hash.ts` | Create | SHA-256 deterministic hash of search params |
| `src/lib/contacts/apollo-client.ts` | Create | Apollo REST wrapper: `searchPeople`, `enrichPerson`, typed errors |
| `src/lib/contacts/search-contacts.ts` | Create | Cache-first search: DB → Apollo → upsert → cache |
| `src/lib/contacts/reveal-contact.ts` | Create | Cache-first reveal: DB check → Apollo enrich → store |
| `src/app/api/contacts/search/route.ts` | Create | `POST /api/contacts/search` — auth, parse, delegate |
| `src/app/api/contacts/[id]/reveal/route.ts` | Create | `POST /api/contacts/[id]/reveal` — auth, delegate, error map |
| `tests/contacts/query-hash.test.ts` | Create | Unit tests for hash function |
| `tests/contacts/apollo-client.test.ts` | Create | Unit tests for Apollo wrapper with mocked axios |
| `tests/contacts/search-contacts.test.ts` | Create | Unit tests for search logic with mocked Prisma + Apollo |
| `tests/contacts/reveal-contact.test.ts` | Create | Unit tests for reveal logic with mocked Prisma + Apollo |
| `.env.local` | Modify | Add `APOLLO_API_KEY` |

---

## Task 1: Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the three new models to `prisma/schema.prisma`**

Open `prisma/schema.prisma` and add these three models at the end of the file (before the last closing line), plus the `contactReveals` relation on the `User` model.

Add to the `User` model (inside the model block, after `extensionAccessTokens`):
```prisma
  contactReveals        ContactReveal[]
```

Append these three models at the end of the file:
```prisma
model Contact {
  id              String    @id @default(uuid()) @db.Uuid
  apolloId        String    @unique @map("apollo_id")
  firstName       String?   @map("first_name")
  lastName        String?   @map("last_name")
  title           String?
  companyName     String?   @map("company_name")
  companyDomain   String?   @map("company_domain")
  linkedinUrl     String?   @map("linkedin_url")
  location        String?
  email           String?
  emailStatus     String?   @map("email_status")
  emailRevealedAt DateTime? @map("email_revealed_at") @db.Timestamptz(6)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)

  reveals ContactReveal[]

  @@index([companyDomain], map: "idx_contacts_company_domain")
  @@map("contacts")
}

model ContactSearchCache {
  id               String   @id @default(uuid()) @db.Uuid
  queryHash        String   @unique @map("query_hash")
  companyDomain    String   @map("company_domain")
  jobFunction      String?  @map("job_function")
  managementLevel  String?  @map("management_level")
  country          String?
  page             Int      @default(1)
  totalEntries     Int?     @map("total_entries")
  contactApolloIds Json     @map("contact_apollo_ids")
  expiresAt        DateTime @map("expires_at") @db.Timestamptz(6)
  createdAt        DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@index([queryHash, expiresAt], map: "idx_contact_search_cache_hash_expires")
  @@map("contact_search_cache")
}

model ContactReveal {
  id         String   @id @default(uuid()) @db.Uuid
  userId     String   @map("user_id")
  contactId  String   @map("contact_id") @db.Uuid
  revealedAt DateTime @default(now()) @map("revealed_at") @db.Timestamptz(6)

  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)
  contact Contact @relation(fields: [contactId], references: [id], onDelete: Cascade)

  @@unique([userId, contactId], map: "uniq_contact_reveal_user_contact")
  @@index([userId], map: "idx_contact_reveals_user_id")
  @@map("contact_reveals")
}
```

- [ ] **Step 2: Run the migration**

```bash
npx prisma migrate dev --name add_contacts_feature
```

Expected output: `The following migration(s) have been created and applied ... add_contacts_feature`

- [ ] **Step 3: Verify Prisma client was regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` with no errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat(db): add Contact, ContactSearchCache, ContactReveal models"
```

---

## Task 2: Query Hash Utility

**Files:**
- Create: `tests/contacts/query-hash.test.ts`
- Create: `src/lib/contacts/query-hash.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/contacts/query-hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildQueryHash } from '@/lib/contacts/query-hash';

describe('buildQueryHash', () => {
  it('returns a 64-char lowercase hex string', () => {
    const hash = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('is deterministic for the same params', () => {
    const params = { companyDomain: 'stripe.com', jobFunction: 'engineering', managementLevel: 'senior', country: 'US', page: 1 };
    expect(buildQueryHash(params)).toBe(buildQueryHash(params));
  });

  it('differs when page changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    const b = buildQueryHash({ companyDomain: 'stripe.com', page: 2 });
    expect(a).not.toBe(b);
  });

  it('differs when companyDomain changes', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    const b = buildQueryHash({ companyDomain: 'openai.com', page: 1 });
    expect(a).not.toBe(b);
  });

  it('treats undefined and omitted optional params the same way', () => {
    const a = buildQueryHash({ companyDomain: 'stripe.com', jobFunction: undefined, page: 1 });
    const b = buildQueryHash({ companyDomain: 'stripe.com', page: 1 });
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
npx vitest run tests/contacts/query-hash.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/contacts/query-hash'`

- [ ] **Step 3: Implement `query-hash.ts`**

Create `src/lib/contacts/query-hash.ts`:

```typescript
import { createHash } from 'crypto';

export interface SearchParams {
  companyDomain: string;
  jobFunction?: string;
  managementLevel?: string;
  country?: string;
  page: number;
}

export function buildQueryHash(params: SearchParams): string {
  const key = [
    params.companyDomain,
    params.jobFunction ?? '',
    params.managementLevel ?? '',
    params.country ?? '',
    params.page,
  ].join('|');
  return createHash('sha256').update(key).digest('hex');
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run tests/contacts/query-hash.test.ts
```

Expected: PASS — 5 tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/query-hash.ts tests/contacts/query-hash.test.ts
git commit -m "feat(contacts): add query hash utility"
```

---

## Task 3: Apollo Client

**Files:**
- Create: `tests/contacts/apollo-client.test.ts`
- Create: `src/lib/contacts/apollo-client.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/contacts/apollo-client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios');

import axios from 'axios';
import {
  searchPeople,
  enrichPerson,
  ApolloAuthError,
  ApolloRateLimitError,
  ApolloNotFoundError,
} from '@/lib/contacts/apollo-client';

const mockedPost = vi.fn();
(axios as unknown as { post: typeof mockedPost }).post = mockedPost;

beforeEach(() => {
  vi.clearAllMocks();
  process.env.APOLLO_API_KEY = 'test-key';
});

afterEach(() => {
  delete process.env.APOLLO_API_KEY;
});

describe('searchPeople', () => {
  it('posts to /mixed_people/search with correct headers and body', async () => {
    mockedPost.mockResolvedValue({ data: { people: [], total_entries: 0 } });

    const result = await searchPeople({ companyDomain: 'stripe.com', page: 1 });

    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.apollo.io/api/v1/mixed_people/search',
      expect.objectContaining({ q_organization_domains_list: ['stripe.com'], page: 1, per_page: 25 }),
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }) })
    );
    expect(result.total_entries).toBe(0);
  });

  it('includes person_seniorities when managementLevel is provided', async () => {
    mockedPost.mockResolvedValue({ data: { people: [], total_entries: 0 } });
    await searchPeople({ companyDomain: 'stripe.com', managementLevel: 'senior', page: 1 });
    expect(mockedPost).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ person_seniorities: ['senior'] }),
      expect.any(Object)
    );
  });

  it('throws ApolloRateLimitError on 429', async () => {
    mockedPost.mockRejectedValue({ response: { status: 429 } });
    await expect(searchPeople({ companyDomain: 'stripe.com', page: 1 })).rejects.toBeInstanceOf(ApolloRateLimitError);
  });

  it('throws ApolloAuthError when APOLLO_API_KEY is not set', async () => {
    delete process.env.APOLLO_API_KEY;
    await expect(searchPeople({ companyDomain: 'stripe.com', page: 1 })).rejects.toBeInstanceOf(ApolloAuthError);
  });
});

describe('enrichPerson', () => {
  it('posts to /people/match with reveal_personal_emails: true', async () => {
    mockedPost.mockResolvedValue({
      data: { person: { email: 'jane@stripe.com', email_status: 'verified' } },
    });

    const result = await enrichPerson('apollo-person-123');

    expect(mockedPost).toHaveBeenCalledWith(
      'https://api.apollo.io/api/v1/people/match',
      { id: 'apollo-person-123', reveal_personal_emails: true },
      expect.objectContaining({ headers: expect.objectContaining({ 'X-Api-Key': 'test-key' }) })
    );
    expect(result.email).toBe('jane@stripe.com');
    expect(result.email_status).toBe('verified');
  });

  it('throws ApolloNotFoundError on 404', async () => {
    mockedPost.mockRejectedValue({ response: { status: 404 } });
    await expect(enrichPerson('missing-id')).rejects.toBeInstanceOf(ApolloNotFoundError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/contacts/apollo-client.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/contacts/apollo-client'`

- [ ] **Step 3: Implement `apollo-client.ts`**

Create `src/lib/contacts/apollo-client.ts`:

```typescript
import axios from 'axios';

const APOLLO_BASE = 'https://api.apollo.io/api/v1';

export class ApolloAuthError extends Error {
  constructor(msg = 'Apollo authentication failed') { super(msg); this.name = 'ApolloAuthError'; }
}
export class ApolloRateLimitError extends Error {
  constructor() { super('Apollo rate limit exceeded'); this.name = 'ApolloRateLimitError'; }
}
export class ApolloNotFoundError extends Error {
  constructor() { super('Apollo contact not found'); this.name = 'ApolloNotFoundError'; }
}
export class ApolloServiceError extends Error {
  constructor(msg: string) { super(msg); this.name = 'ApolloServiceError'; }
}

function getHeaders(): Record<string, string> {
  const key = process.env.APOLLO_API_KEY;
  if (!key) throw new ApolloAuthError('APOLLO_API_KEY is not set');
  return { 'X-Api-Key': key, 'Content-Type': 'application/json' };
}

function handleAxiosError(err: unknown): never {
  const status = (err as { response?: { status?: number } })?.response?.status;
  if (status !== undefined) {
    if (status === 401) throw new ApolloAuthError('Invalid Apollo API key');
    if (status === 429) throw new ApolloRateLimitError();
    if (status === 404) throw new ApolloNotFoundError();
    throw new ApolloServiceError(`Apollo API error: ${status}`);
  }
  throw err;
}

export interface ApolloPersonResult {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  linkedin_url: string | null;
  city: string | null;
  organization: { name: string | null; primary_domain: string | null } | null;
}

export interface ApolloSearchParams {
  companyDomain: string;
  jobFunction?: string;
  managementLevel?: string;
  country?: string;
  page: number;
}

export interface ApolloSearchResponse {
  people: ApolloPersonResult[];
  total_entries: number;
}

export async function searchPeople(params: ApolloSearchParams): Promise<ApolloSearchResponse> {
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/mixed_people/search`,
      {
        q_organization_domains_list: [params.companyDomain],
        ...(params.jobFunction      ? { person_titles:      [params.jobFunction]      } : {}),
        ...(params.managementLevel  ? { person_seniorities: [params.managementLevel]  } : {}),
        ...(params.country          ? { person_locations:   [params.country]          } : {}),
        page: params.page,
        per_page: 25,
      },
      { headers: getHeaders() },
    );
    return data as ApolloSearchResponse;
  } catch (err) {
    handleAxiosError(err);
  }
}

export interface ApolloPersonDetail {
  email: string | null;
  email_status: string | null;
}

export async function enrichPerson(apolloPersonId: string): Promise<ApolloPersonDetail> {
  try {
    const { data } = await axios.post(
      `${APOLLO_BASE}/people/match`,
      { id: apolloPersonId, reveal_personal_emails: true },
      { headers: getHeaders() },
    );
    return data.person as ApolloPersonDetail;
  } catch (err) {
    handleAxiosError(err);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/contacts/apollo-client.test.ts
```

Expected: PASS — all tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/apollo-client.ts tests/contacts/apollo-client.test.ts
git commit -m "feat(contacts): add Apollo.io client with typed errors"
```

---

## Task 4: Search Service

**Files:**
- Create: `tests/contacts/search-contacts.test.ts`
- Create: `src/lib/contacts/search-contacts.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/contacts/search-contacts.test.ts`:

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

vi.mock('@/lib/contacts/apollo-client', () => ({
  searchPeople: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { searchPeople } from '@/lib/contacts/apollo-client';
import { searchContacts } from '@/lib/contacts/search-contacts';

const mockPrisma = vi.mocked(prisma, true);
const mockSearchPeople = vi.mocked(searchPeople);

const PARAMS = { companyDomain: 'stripe.com', jobFunction: 'engineering', managementLevel: 'senior', country: 'US', page: 1 };

const APOLLO_PERSON = {
  id: 'apollo-1',
  first_name: 'Jane',
  last_name: 'Doe',
  title: 'Senior Engineer',
  linkedin_url: 'https://linkedin.com/in/janedoe',
  city: 'San Francisco',
  organization: { name: 'Stripe', primary_domain: 'stripe.com' },
};

const DB_CONTACT = {
  id: 'uuid-1',
  apolloId: 'apollo-1',
  firstName: 'Jane',
  lastName: 'Doe',
  title: 'Senior Engineer',
  companyName: 'Stripe',
  companyDomain: 'stripe.com',
  linkedinUrl: 'https://linkedin.com/in/janedoe',
  location: 'San Francisco',
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
      contactApolloIds: ['apollo-1'],
      expiresAt: new Date(Date.now() + 86400000),
    });
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([DB_CONTACT]);
  });

  it('returns cached contacts without calling Apollo', async () => {
    const result = await searchContacts(PARAMS);
    expect(mockSearchPeople).not.toHaveBeenCalled();
    expect(result.cached).toBe(true);
    expect(result.contacts).toHaveLength(1);
    expect(result.contacts[0].firstName).toBe('Jane');
    expect(result.contacts[0].emailRevealed).toBe(false);
  });

  it('returns emailRevealed: true when contact has an email', async () => {
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([{ ...DB_CONTACT, email: 'jane@stripe.com' }]);
    const result = await searchContacts(PARAMS);
    expect(result.contacts[0].emailRevealed).toBe(true);
  });
});

describe('searchContacts — cache MISS', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contactSearchCache.findFirst = vi.fn().mockResolvedValue(null);
    mockSearchPeople.mockResolvedValue({ people: [APOLLO_PERSON], total_entries: 1 });
    mockPrisma.contact.upsert = vi.fn().mockResolvedValue(DB_CONTACT);
    mockPrisma.contactSearchCache.create = vi.fn().mockResolvedValue({});
    mockPrisma.contact.findMany = vi.fn().mockResolvedValue([DB_CONTACT]);
  });

  it('calls Apollo and upserts the contact', async () => {
    const result = await searchContacts(PARAMS);
    expect(mockSearchPeople).toHaveBeenCalledOnce();
    expect(mockPrisma.contact.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { apolloId: 'apollo-1' } })
    );
    expect(result.cached).toBe(false);
    expect(result.totalEntries).toBe(1);
  });

  it('writes a cache entry with 7-day expiry', async () => {
    await searchContacts(PARAMS);
    expect(mockPrisma.contactSearchCache.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contactApolloIds: ['apollo-1'],
          totalEntries: 1,
        }),
      })
    );
    const call = vi.mocked(mockPrisma.contactSearchCache.create).mock.calls[0][0];
    const expiresAt: Date = call.data.expiresAt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5000);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/contacts/search-contacts.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/contacts/search-contacts'`

- [ ] **Step 3: Implement `search-contacts.ts`**

Create `src/lib/contacts/search-contacts.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { searchPeople } from './apollo-client';
import { buildQueryHash, type SearchParams } from './query-hash';

export interface ContactSearchResult {
  id: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  companyName: string | null;
  companyDomain: string | null;
  linkedinUrl: string | null;
  emailRevealed: boolean;
}

export interface SearchContactsResponse {
  contacts: ContactSearchResult[];
  totalEntries: number;
  page: number;
  cached: boolean;
}

export async function searchContacts(params: SearchParams): Promise<SearchContactsResponse> {
  const queryHash = buildQueryHash(params);

  const cache = await prisma.contactSearchCache.findFirst({
    where: { queryHash, expiresAt: { gt: new Date() } },
  });

  if (cache) {
    const apolloIds = cache.contactApolloIds as string[];
    const contacts = await prisma.contact.findMany({ where: { apolloId: { in: apolloIds } } });
    return { contacts: contacts.map(toSearchResult), totalEntries: cache.totalEntries ?? 0, page: params.page, cached: true };
  }

  const result = await searchPeople(params);
  const apolloIds: string[] = [];

  for (const person of result.people) {
    await prisma.contact.upsert({
      where: { apolloId: person.id },
      create: {
        apolloId: person.id,
        firstName: person.first_name,
        lastName: person.last_name,
        title: person.title,
        companyName: person.organization?.name ?? null,
        companyDomain: person.organization?.primary_domain ?? null,
        linkedinUrl: person.linkedin_url,
        location: person.city,
      },
      update: {
        firstName: person.first_name,
        lastName: person.last_name,
        title: person.title,
        companyName: person.organization?.name ?? null,
        companyDomain: person.organization?.primary_domain ?? null,
        linkedinUrl: person.linkedin_url,
        location: person.city,
      },
    });
    apolloIds.push(person.id);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.contactSearchCache.create({
    data: {
      queryHash,
      companyDomain: params.companyDomain,
      jobFunction: params.jobFunction,
      managementLevel: params.managementLevel,
      country: params.country,
      page: params.page,
      totalEntries: result.total_entries,
      contactApolloIds: apolloIds,
      expiresAt,
    },
  });

  const contacts = await prisma.contact.findMany({ where: { apolloId: { in: apolloIds } } });
  return { contacts: contacts.map(toSearchResult), totalEntries: result.total_entries, page: params.page, cached: false };
}

function toSearchResult(c: {
  id: string; firstName: string | null; lastName: string | null; title: string | null;
  companyName: string | null; companyDomain: string | null; linkedinUrl: string | null; email: string | null;
}): ContactSearchResult {
  return {
    id: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    title: c.title,
    companyName: c.companyName,
    companyDomain: c.companyDomain,
    linkedinUrl: c.linkedinUrl,
    emailRevealed: c.email !== null,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/contacts/search-contacts.test.ts
```

Expected: PASS — all tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/search-contacts.ts tests/contacts/search-contacts.test.ts
git commit -m "feat(contacts): add cache-first search service"
```

---

## Task 5: Reveal Service

**Files:**
- Create: `tests/contacts/reveal-contact.test.ts`
- Create: `src/lib/contacts/reveal-contact.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/contacts/reveal-contact.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    contact: { findUnique: vi.fn(), update: vi.fn() },
    contactReveal: { upsert: vi.fn() },
  },
}));

vi.mock('@/lib/contacts/apollo-client', () => ({
  enrichPerson: vi.fn(),
}));

import { prisma } from '@/lib/prisma';
import { enrichPerson } from '@/lib/contacts/apollo-client';
import { revealContactEmail, ContactNotFoundError } from '@/lib/contacts/reveal-contact';

const mockPrisma = vi.mocked(prisma, true);
const mockEnrichPerson = vi.mocked(enrichPerson);

const CONTACT_NO_EMAIL = {
  id: 'uuid-1', apolloId: 'apollo-1', firstName: 'Jane', lastName: 'Doe',
  title: 'Senior Engineer', companyName: 'Stripe', companyDomain: 'stripe.com',
  linkedinUrl: null, location: null, email: null, emailStatus: null, emailRevealedAt: null,
  createdAt: new Date(), updatedAt: new Date(),
};

describe('revealContactEmail — email already cached', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contact.findUnique = vi.fn().mockResolvedValue({ ...CONTACT_NO_EMAIL, email: 'jane@stripe.com', emailStatus: 'verified' });
    mockPrisma.contactReveal.upsert = vi.fn().mockResolvedValue({});
  });

  it('returns the cached email without calling Apollo', async () => {
    const result = await revealContactEmail('uuid-1', 'user-1');
    expect(mockEnrichPerson).not.toHaveBeenCalled();
    expect(result.email).toBe('jane@stripe.com');
    expect(result.emailStatus).toBe('verified');
    expect(result.fromCache).toBe(true);
  });

  it('upserts a ContactReveal record', async () => {
    await revealContactEmail('uuid-1', 'user-1');
    expect(mockPrisma.contactReveal.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_contactId: { userId: 'user-1', contactId: 'uuid-1' } } })
    );
  });
});

describe('revealContactEmail — email not yet fetched', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contact.findUnique = vi.fn().mockResolvedValue(CONTACT_NO_EMAIL);
    mockEnrichPerson.mockResolvedValue({ email: 'jane@stripe.com', email_status: 'verified' });
    mockPrisma.contact.update = vi.fn().mockResolvedValue({ ...CONTACT_NO_EMAIL, email: 'jane@stripe.com', emailStatus: 'verified' });
    mockPrisma.contactReveal.upsert = vi.fn().mockResolvedValue({});
  });

  it('calls Apollo enrichment and stores the email', async () => {
    const result = await revealContactEmail('uuid-1', 'user-1');
    expect(mockEnrichPerson).toHaveBeenCalledWith('apollo-1');
    expect(mockPrisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'uuid-1' },
        data: expect.objectContaining({ email: 'jane@stripe.com', emailStatus: 'verified' }),
      })
    );
    expect(result.email).toBe('jane@stripe.com');
    expect(result.fromCache).toBe(false);
  });
});

describe('revealContactEmail — contact not found', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.contact.findUnique = vi.fn().mockResolvedValue(null);
  });

  it('throws ContactNotFoundError', async () => {
    await expect(revealContactEmail('missing-id', 'user-1')).rejects.toBeInstanceOf(ContactNotFoundError);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
npx vitest run tests/contacts/reveal-contact.test.ts
```

Expected: FAIL — `Cannot find module '@/lib/contacts/reveal-contact'`

- [ ] **Step 3: Implement `reveal-contact.ts`**

Create `src/lib/contacts/reveal-contact.ts`:

```typescript
import { prisma } from '@/lib/prisma';
import { enrichPerson } from './apollo-client';

export class ContactNotFoundError extends Error {
  constructor() { super('Contact not found'); this.name = 'ContactNotFoundError'; }
}

export interface RevealResult {
  email: string;
  emailStatus: string | null;
  fromCache: boolean;
}

export async function revealContactEmail(contactId: string, userId: string): Promise<RevealResult> {
  const contact = await prisma.contact.findUnique({ where: { id: contactId } });
  if (!contact) throw new ContactNotFoundError();

  if (contact.email) {
    await prisma.contactReveal.upsert({
      where: { userId_contactId: { userId, contactId } },
      create: { userId, contactId },
      update: {},
    });
    return { email: contact.email, emailStatus: contact.emailStatus, fromCache: true };
  }

  const person = await enrichPerson(contact.apolloId);
  if (!person.email) throw new Error('Apollo returned no email for this contact');

  const updated = await prisma.contact.update({
    where: { id: contactId },
    data: { email: person.email, emailStatus: person.email_status, emailRevealedAt: new Date() },
  });

  await prisma.contactReveal.upsert({
    where: { userId_contactId: { userId, contactId } },
    create: { userId, contactId },
    update: {},
  });

  return { email: updated.email!, emailStatus: updated.emailStatus, fromCache: false };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
npx vitest run tests/contacts/reveal-contact.test.ts
```

Expected: PASS — all tests passed

- [ ] **Step 5: Commit**

```bash
git add src/lib/contacts/reveal-contact.ts tests/contacts/reveal-contact.test.ts
git commit -m "feat(contacts): add cache-first reveal service"
```

---

## Task 6: Search API Route

**Files:**
- Create: `src/app/api/contacts/search/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/contacts/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchContacts } from '@/lib/contacts/search-contacts';
import {
  ApolloAuthError,
  ApolloRateLimitError,
  ApolloServiceError,
} from '@/lib/contacts/apollo-client';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyDomain, jobFunction, managementLevel, country, page = 1 } = body as {
    companyDomain?: string;
    jobFunction?: string;
    managementLevel?: string;
    country?: string;
    page?: number;
  };

  if (!companyDomain) {
    return NextResponse.json({ error: 'companyDomain is required' }, { status: 400 });
  }

  try {
    const result = await searchContacts({ companyDomain, jobFunction, managementLevel, country, page });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApolloAuthError) return NextResponse.json({ error: 'Apollo configuration error' }, { status: 500 });
    if (err instanceof ApolloRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ApolloServiceError) return NextResponse.json({ error: 'Apollo service unavailable' }, { status: 502 });
    console.error('[contacts/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke test**

With your dev server running (`npm run dev`), run:

```bash
curl -X POST http://localhost:3000/api/contacts/search \
  -H "Content-Type: application/json" \
  -d '{"companyDomain":"stripe.com","jobFunction":"engineering","managementLevel":"senior","country":"US","page":1}' \
  -b "<your-clerk-session-cookie>"
```

Expected: JSON with `contacts`, `totalEntries`, `page`, `cached` fields. Without a valid session cookie you'll get `{"error":"Unauthorized"}` — that's correct.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contacts/search/route.ts
git commit -m "feat(contacts): add POST /api/contacts/search route"
```

---

## Task 7: Reveal API Route

**Files:**
- Create: `src/app/api/contacts/[id]/reveal/route.ts`

- [ ] **Step 1: Create the route handler**

Create `src/app/api/contacts/[id]/reveal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { revealContactEmail, ContactNotFoundError } from '@/lib/contacts/reveal-contact';
import {
  ApolloAuthError,
  ApolloRateLimitError,
  ApolloNotFoundError,
  ApolloServiceError,
} from '@/lib/contacts/apollo-client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: contactId } = await params;

  try {
    const result = await revealContactEmail(contactId, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ContactNotFoundError) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    if (err instanceof ApolloAuthError) return NextResponse.json({ error: 'Apollo configuration error' }, { status: 500 });
    if (err instanceof ApolloRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ApolloNotFoundError) return NextResponse.json({ error: 'Contact not found in Apollo' }, { status: 404 });
    if (err instanceof ApolloServiceError) return NextResponse.json({ error: 'Apollo service unavailable' }, { status: 502 });
    console.error('[contacts/reveal]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

- [ ] **Step 2: Manual smoke test**

With your dev server running, first get a contact ID from the search endpoint, then:

```bash
curl -X POST http://localhost:3000/api/contacts/<uuid-from-search>/reveal \
  -H "Content-Type: application/json" \
  -b "<your-clerk-session-cookie>"
```

Expected: `{"email":"...","emailStatus":"verified","fromCache":false}` on first call, `fromCache: true` on repeat.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/contacts/[id]/reveal/route.ts
git commit -m "feat(contacts): add POST /api/contacts/[id]/reveal route"
```

---

## Task 8: Environment Variable

**Files:**
- Modify: `.env.local`

- [ ] **Step 1: Add Apollo API key to `.env.local`**

Open `.env.local` and add:

```
# Apollo.io — platform-wide key, developer pays
APOLLO_API_KEY=your_apollo_api_key_here
```

Replace `your_apollo_api_key_here` with your real Apollo API key from https://app.apollo.io/#/settings/integrations/api.

- [ ] **Step 2: Restart the dev server**

Stop and restart `npm run dev` so Next.js picks up the new env variable.

- [ ] **Step 3: Run the full test suite**

```bash
npx vitest run tests/contacts/
```

Expected: All tests in all four test files pass.

- [ ] **Step 4: Final commit**

`.env.local` is gitignored (correctly). No commit needed for that file. Tag the feature complete:

```bash
git tag contacts-backend-v1
```

---

## Done

The backend is complete. The feature exposes:

- `POST /api/contacts/search` — returns name/title/company for employees at a company (cached 7 days)
- `POST /api/contacts/[id]/reveal` — returns verified email (cached permanently platform-wide)

Next steps when ready: build the frontend search UI, then wire in Stripe subscription tiers using the `ContactReveal` table for quota enforcement.
