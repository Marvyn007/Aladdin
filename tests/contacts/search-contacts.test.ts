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
    const expiresAt: Date = (call as { data: { expiresAt: Date } }).data.expiresAt;
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + sevenDaysMs - 5000);
  });
});
