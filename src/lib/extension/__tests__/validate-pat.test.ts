import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the module under test
vi.mock('@/lib/prisma', () => ({
  prisma: {
    extensionAccessToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { validateExtensionPat } from '../validate-pat';
import { prisma } from '@/lib/prisma';

function makeRequest(token: string) {
  return new Request('http://localhost/api/extension/auth', {
    headers: { Authorization: `Bearer ${token}` },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('validateExtensionPat', () => {
  it('returns null for missing Authorization header', async () => {
    const req = new Request('http://localhost/api/extension/auth');
    expect(await validateExtensionPat(req)).toBeNull();
  });

  it('returns null for non-ald_ext_ token', async () => {
    expect(await validateExtensionPat(makeRequest('sk-abc123'))).toBeNull();
  });

  it('returns null when token not found in DB', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue(null);
    expect(await validateExtensionPat(makeRequest('ald_ext_abc123'))).toBeNull();
  });

  it('returns null for revoked token', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue({
      id: 'tok_1',
      userId: 'user_1',
      tokenHash: 'hash',
      label: null,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: new Date(),
    });
    expect(await validateExtensionPat(makeRequest('ald_ext_abc123'))).toBeNull();
  });

  it('returns { userId } for valid token and updates lastUsedAt', async () => {
    vi.mocked(prisma.extensionAccessToken.findUnique).mockResolvedValue({
      id: 'tok_1',
      userId: 'user_1',
      tokenHash: 'hash',
      label: null,
      createdAt: new Date(),
      lastUsedAt: null,
      revokedAt: null,
    });
    vi.mocked(prisma.extensionAccessToken.update).mockResolvedValue({} as any);

    const result = await validateExtensionPat(makeRequest('ald_ext_abc123'));
    expect(result).toEqual({ userId: 'user_1' });
    expect(prisma.extensionAccessToken.update).toHaveBeenCalledWith({
      where: { tokenHash: expect.any(String) },
      data: { lastUsedAt: expect.any(Date) },
    });
  });
});
