import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateRawToken, hashToken, validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

/** GET (Clerk auth): check whether the user has an active PAT */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await prisma.extensionAccessToken.findFirst({
    where:   { userId, revokedAt: null },
    orderBy: { createdAt: 'desc' },
    select:  { createdAt: true, lastUsedAt: true },
  });

  return NextResponse.json({
    hasToken:   !!row,
    createdAt:  row?.createdAt?.toISOString()  ?? null,
    lastUsedAt: row?.lastUsedAt?.toISOString() ?? null,
  });
}

/** POST (Clerk auth): generate a new PAT — revokes any existing active tokens */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Revoke all existing active tokens for this user
  await prisma.extensionAccessToken.updateMany({
    where: { userId, revokedAt: null },
    data:  { revokedAt: new Date() },
  });

  const raw = generateRawToken();

  await prisma.extensionAccessToken.create({
    data: {
      userId,
      tokenHash: hashToken(raw),
      label: 'Chrome Extension',
    },
  });

  return NextResponse.json({ token: raw });
}

/** DELETE (PAT auth): revoke the current token (called on extension sign-out) */
export async function DELETE(request: NextRequest) {
  const result = await validateExtensionPat(request);
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = request.headers.get('Authorization')?.slice(7).trim() ?? '';
  const tokenHash = hashToken(raw);

  await prisma.extensionAccessToken.updateMany({
    where: { userId: result.userId, tokenHash, revokedAt: null },
    data:  { revokedAt: new Date() },
  });

  return NextResponse.json({ success: true });
}
