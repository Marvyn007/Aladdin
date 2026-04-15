import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export const dynamic = 'force-dynamic';

const ONBOARDING_ENTRY_COOKIE = 'aladdin_onboarding_entry';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = NextResponse.json({ success: true });
  // Allow entry to /onboarding only when user explicitly chooses "Finish setup".
  res.cookies.set(ONBOARDING_ENTRY_COOKIE, '1', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 15, // 15 minutes
  });
  return res;
}

