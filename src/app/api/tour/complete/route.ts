import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const ONBOARDING_ENTRY_COOKIE = 'aladdin_onboarding_entry';

export async function PATCH(_req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await prisma.appSettings.upsert({
      where: { userId },
      update: { toured: true },
      create: { userId, toured: true },
    });
  } catch {
    return NextResponse.json({ error: 'Failed to save tour status' }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  // Allow entry to /onboarding only when sent there intentionally (tour -> onboarding).
  res.cookies.set(ONBOARDING_ENTRY_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15, // 15 minutes
  });
  return res;
}
