import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { generateRawToken, hashToken, validateExtensionPat } from '@/lib/extension/validate-pat';

export const dynamic = 'force-dynamic';

type TokenRow = { created_at: Date | null; last_used_at: Date | null };

/** GET (Clerk auth): check whether the user has an active PAT */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rows = await prisma.$queryRaw<TokenRow[]>`
    SELECT created_at, last_used_at
    FROM extension_access_tokens
    WHERE user_id = ${userId} AND revoked_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  `;
  const row = rows[0] ?? null;

  return NextResponse.json({
    hasToken:   !!row,
    createdAt:  row?.created_at?.toISOString()  ?? null,
    lastUsedAt: row?.last_used_at?.toISOString() ?? null,
  });
}

/** POST (Clerk auth): generate a new PAT — revokes any existing active tokens */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Revoke all existing active tokens for this user (raw SQL — client regeneration pending)
  await prisma.$executeRaw`
    UPDATE extension_access_tokens
    SET revoked_at = NOW()
    WHERE user_id = ${userId} AND revoked_at IS NULL
  `;

  const raw = generateRawToken();

  await prisma.$executeRaw`
    INSERT INTO extension_access_tokens (id, user_id, token_hash, label, created_at)
    VALUES (gen_random_uuid(), ${userId}, ${hashToken(raw)}, 'Chrome Extension', NOW())
  `;

  return NextResponse.json({ token: raw });
}

/** DELETE (PAT auth): revoke the current token (called on extension sign-out) */
export async function DELETE(request: NextRequest) {
  const result = await validateExtensionPat(request);
  if (!result) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const raw = request.headers.get('Authorization')?.slice(7).trim() ?? '';
  const tokenHash = hashToken(raw);

  await prisma.$executeRaw`
    UPDATE extension_access_tokens
    SET revoked_at = NOW()
    WHERE user_id = ${result.userId} AND token_hash = ${tokenHash} AND revoked_at IS NULL
  `;

  return NextResponse.json({ success: true });
}
