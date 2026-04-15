// src/lib/auto-apply/build-profile-context.ts
import { prisma } from '@/lib/prisma';
import type { ProfileContext } from './match-field';

/**
 * Fetch all data needed by the auto-apply agent from Neon and return
 * a ProfileContext ready for matchFieldToProfile.
 */
export async function buildProfileContext(userId: string): Promise<ProfileContext> {
  const [user, onboardingAnswers, resume] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    }),
    prisma.onboardingAnswer.findMany({
      where: { userId },
      select: { questionKey: true, answerText: true },
    }),
    prisma.resume.findFirst({
      where: { userId },
      orderBy: { uploadAt: 'desc' },
      select: { parsedJson: true, filename: true },
    }),
  ]);

  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    const json = resume.parsedJson as Record<string, unknown>;
    if (typeof json.summary === 'string') {
      resumeSummary = json.summary;
    } else {
      resumeSummary = JSON.stringify(json).slice(0, 1000);
    }
  }

  return {
    user: {
      firstName: user?.firstName ?? null,
      lastName:  user?.lastName  ?? null,
      email:     user?.email     ?? null,
    },
    onboardingAnswers: onboardingAnswers.map(a => ({
      questionKey: a.questionKey,
      answerText:  a.answerText,
    })),
    userContext:   {},
    resumeSummary,
  };
}
