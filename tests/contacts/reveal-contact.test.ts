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
