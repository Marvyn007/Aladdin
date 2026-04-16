import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/** GET (PAT auth): validate token and return basic user info */
export async function GET(request: NextRequest) {
  const result = await validateExtensionPat(request);
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const user = await prisma.user.findUnique({
    where:  { id: result.userId },
    select: { firstName: true, lastName: true, email: true },
  });

  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  return NextResponse.json({
    userId:    result.userId,
    firstName: user.firstName ?? null,
    lastName:  user.lastName  ?? null,
    email:     user.email     ?? null,
  });
}
