// src/lib/auto-apply/build-profile-context.ts
import { prisma } from '@/lib/prisma';
import type { ProfileContext } from './match-field';
import { applyPilotPayloadToUserContext } from '@/lib/apply-pilot-profile/flatten';
import { parseApplyPilotPayload } from '@/lib/apply-pilot-profile/types';
import { formatApplyPilotNarrative } from '@/lib/apply-pilot-profile/narrative';
import { parsedResumeJsonToAgentText } from '@/lib/auto-apply/parsed-resume-for-agent';

export interface BuildProfileContextOptions {
  /** When provided (e.g. from execute-session), avoids a second Job query. */
  jobPack?: NonNullable<ProfileContext['jobPack']>;
}

/**
 * Fetch all data needed by the auto-apply agent from Neon and return
 * a ProfileContext ready for matchFieldToProfile.
 */
export async function buildProfileContext(
  userId: string,
  opts?: BuildProfileContextOptions
): Promise<ProfileContext> {
  const [user, onboardingAnswers, resume, applyPilot] = await Promise.all([
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
    prisma.applyPilotProfile.findUnique({
      where: { userId },
      select: { payload: true },
    }),
  ]);

  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    resumeSummary = parsedResumeJsonToAgentText(resume.parsedJson);
    if (!resumeSummary.trim()) {
      resumeSummary = JSON.stringify(resume.parsedJson).slice(0, 4000);
    }
  }

  const payload = parseApplyPilotPayload(applyPilot?.payload);
  const userContext = applyPilotPayloadToUserContext(payload);
  const applyPilotAnswersJson = JSON.stringify(payload);

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
    userContext,
    resumeSummary,
    jobPack:               opts?.jobPack,
    applyPilotNarrative:   formatApplyPilotNarrative(payload, user ?? {}),
    applyPilotAnswersJson,
  };
}
