import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    appSettings: {
      upsert: vi.fn(),
    },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

describe('PATCH /api/tour/complete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as never);
    const { PATCH } = await import('../complete/route');
    const req = new Request('http://localhost/api/tour/complete', { method: 'PATCH' });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it('upserts toured=true and returns success when authenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_123' } as never);
    vi.mocked(prisma.appSettings.upsert).mockResolvedValue({} as never);

    const { PATCH } = await import('../complete/route');
    const req = new Request('http://localhost/api/tour/complete', { method: 'PATCH' });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(prisma.appSettings.upsert).toHaveBeenCalledWith({
      where: { userId: 'user_123' },
      update: { toured: true },
      create: { userId: 'user_123', toured: true },
    });
  });
});
