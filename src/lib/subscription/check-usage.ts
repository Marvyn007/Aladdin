import { prisma } from '@/lib/prisma';
import { PlanType, UsageFeature, TIER_LIMITS, UNLIMITED, SOFT_CAP } from './tier-config';

export type GuardReason = 'UNAUTHORIZED' | 'LIMIT_REACHED';

export type GuardResult =
  | { allowed: true }
  | { allowed: false; reason: GuardReason; resetDate: string | null };

export function isAtLimit(current: number, limit: number): boolean {
  return current >= limit;
}

export function isAtSoftCap(current: number, limit: number): boolean {
  return limit === UNLIMITED && current >= SOFT_CAP;
}

export async function checkAndIncrement(
  userId: string,
  feature: UsageFeature
): Promise<GuardResult> {
  const [sub, usage] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.userUsage.findUnique({ where: { userId } }),
  ]);

  const plan = (sub?.planType ?? 'LITE') as PlanType;
  const resetDate = sub?.currentPeriodEnd?.toISOString() ?? null;
  const current = usage?.[feature] ?? 0;
  const limit = TIER_LIMITS[plan][feature];

  if (plan === 'LITE') return { allowed: false, reason: 'UNAUTHORIZED', resetDate: null };
  if (isAtSoftCap(current, limit)) return { allowed: false, reason: 'LIMIT_REACHED', resetDate };
  if (isAtLimit(current, limit)) return { allowed: false, reason: 'LIMIT_REACHED', resetDate };

  await prisma.userUsage.upsert({
    where: { userId },
    create: { userId, [feature]: 1 },
    update: { [feature]: { increment: 1 } },
  });

  return { allowed: true };
}
