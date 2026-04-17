import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { TIER_LIMITS, PlanType } from '@/lib/subscription/tier-config';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [sub, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.userUsage.findUnique({ where: { userId } }),
  ]);

  const planType = (sub?.planType ?? 'LITE') as PlanType;
  const limits = TIER_LIMITS[planType];

  return NextResponse.json({
    planType,
    status: sub?.status ?? 'active',
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    currentPeriodEnd: sub?.currentPeriodEnd ?? null,
    usage: {
      resumesGenerated: usage?.resumesGenerated ?? 0,
      coverLettersGenerated: usage?.coverLettersGenerated ?? 0,
      emailsRetrieved: usage?.emailsRetrieved ?? 0,
      linkedinRetrieved: usage?.linkedinRetrieved ?? 0,
    },
    limits: {
      resumesGenerated: limits.resumesGenerated,
      coverLettersGenerated: limits.coverLettersGenerated,
      emailsRetrieved: limits.emailsRetrieved,
      linkedinRetrieved: limits.linkedinRetrieved,
    },
  });
}
