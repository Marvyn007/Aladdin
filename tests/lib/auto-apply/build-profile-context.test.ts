import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    onboardingAnswer: { findMany: vi.fn() },
    resume: { findFirst: vi.fn() },
  },
}));

import { buildProfileContext } from '@/lib/auto-apply/build-profile-context';
import { prisma } from '@/lib/prisma';

beforeEach(() => vi.clearAllMocks());

describe('buildProfileContext', () => {
  it('assembles user, onboarding answers, and resume summary', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com',
    } as never);
    vi.mocked(prisma.onboardingAnswer.findMany).mockResolvedValue([
      { questionKey: 'aa_phone', answerText: '555-1234' },
    ] as never);
    vi.mocked(prisma.resume.findFirst).mockResolvedValue({
      parsedJson: { summary: 'Experienced engineer' },
      filename: 'resume.pdf',
    } as never);

    const ctx = await buildProfileContext('user-123');

    expect(ctx.user.firstName).toBe('Jane');
    expect(ctx.user.email).toBe('jane@example.com');
    expect(ctx.onboardingAnswers).toHaveLength(1);
    expect(ctx.onboardingAnswers[0].questionKey).toBe('aa_phone');
    expect(ctx.resumeSummary).toContain('Experienced engineer');
  });

  it('returns empty profile when user not found', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.onboardingAnswer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.resume.findFirst).mockResolvedValue(null);

    const ctx = await buildProfileContext('missing-user');

    expect(ctx.user.firstName).toBeNull();
    expect(ctx.onboardingAnswers).toHaveLength(0);
    expect(ctx.resumeSummary).toBe('');
  });

  it('handles resume with no parsedJson', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      firstName: 'Jane', lastName: 'Doe', email: 'jane@example.com',
    } as never);
    vi.mocked(prisma.onboardingAnswer.findMany).mockResolvedValue([] as never);
    vi.mocked(prisma.resume.findFirst).mockResolvedValue({
      parsedJson: null, filename: 'resume.pdf',
    } as never);

    const ctx = await buildProfileContext('user-123');
    expect(ctx.resumeSummary).toBe('');
  });
});
