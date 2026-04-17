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

vi.mock('@/lib/contacts/prospeo-client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/contacts/prospeo-client')>();
  return { ...actual, searchPeople: vi.fn() };
});

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
