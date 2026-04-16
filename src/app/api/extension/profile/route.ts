import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';
import { applyPilotPayloadToUserContext } from '@/lib/apply-pilot-profile/flatten';
import { parseApplyPilotPayload } from '@/lib/apply-pilot-profile/types';
import { parsedResumeJsonToAgentText } from '@/lib/auto-apply/parsed-resume-for-agent';

export const dynamic = 'force-dynamic';

/** GET (PAT auth): full profile with Apply Pilot aa_* keys in userContext */
export async function GET(request: NextRequest) {
  const pat = await validateExtensionPat(request);
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = pat;

  const [user, onboardingAnswers, resume, applyPilot, coverLetterRow] = await Promise.all([
    prisma.user.findUnique({
      where:  { id: userId },
      select: { firstName: true, lastName: true, email: true, userContext: true },
    }),
    prisma.onboardingAnswer.findMany({
      where:  { userId },
      select: { questionKey: true, answerText: true },
    }),
    prisma.resume.findFirst({
      where:   { userId, archivedAt: null },
      orderBy: { uploadAt: 'desc' },
      select:  { parsedJson: true, filename: true, s3Key: true, fileData: true },
    }),
    prisma.applyPilotProfile.findUnique({
      where:  { userId },
      select: { payload: true },
    }),
    prisma.coverLetter.findFirst({
      where:   { userId },
      orderBy: { createdAt: 'desc' },
      select:  { s3Key: true },
    }),
  ]);

  // Apply Pilot → aa_* keys
  const payload = parseApplyPilotPayload(applyPilot?.payload);
  const applyPilotContext = applyPilotPayloadToUserContext(payload);

  // Learned custom answers from User.userContext — Apply Pilot keys win on conflict
  const learnedContext: Record<string, string> =
    user?.userContext && typeof user.userContext === 'object'
      ? (user.userContext as Record<string, string>)
      : {};

  const userContext: Record<string, string> = { ...learnedContext, ...applyPilotContext };

  // Resume summary for LLM context
  let resumeSummary = '';
  if (resume?.parsedJson && typeof resume.parsedJson === 'object') {
    resumeSummary = parsedResumeJsonToAgentText(resume.parsedJson);
  }

  return NextResponse.json({
    user: {
      firstName: user?.firstName ?? null,
      lastName:  user?.lastName  ?? null,
      email:     user?.email     ?? null,
    },
    userContext,
    onboardingAnswers: onboardingAnswers.map(a => ({
      questionKey: a.questionKey,
      answerText:  a.answerText,
    })),
    resumeSummary,
    documents: {
      resume: {
        ready:    !!(resume?.s3Key || resume?.fileData),
        filename: resume?.filename ?? '',
      },
      coverLetter: {
        ready:    !!(coverLetterRow?.s3Key),
        filename: '',
      },
    },
  });
}

/** POST (PAT auth): merge learned answers into User.userContext */
export async function POST(request: NextRequest) {
  const pat = await validateExtensionPat(request);
  if (!pat) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { userId } = pat;
  const body = await request.json().catch(() => ({}));

  const incomingContext: Record<string, string> =
    body?.context && typeof body.context === 'object' ? body.context : {};

  if (body?.replace) {
    await prisma.user.update({
      where: { id: userId },
      data:  { userContext: incomingContext },
    });
  } else {
    const existing = await prisma.user.findUnique({
      where:  { id: userId },
      select: { userContext: true },
    });
    const prev: Record<string, string> =
      existing?.userContext && typeof existing.userContext === 'object'
        ? (existing.userContext as Record<string, string>)
        : {};
    await prisma.user.update({
      where: { id: userId },
      data:  { userContext: { ...prev, ...incomingContext } },
    });
  }

  return NextResponse.json({ success: true });
}
