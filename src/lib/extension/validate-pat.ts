import { createHash, randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';

export function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

export function generateRawToken(): string {
  return `ald_ext_${randomBytes(16).toString('hex')}`;
}

function extractBearer(request: Request): string | null {
  const auth = request.headers.get('Authorization') ?? '';
  if (!auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

export async function validateExtensionPat(
  request: Request
): Promise<{ userId: string } | null> {
  const raw = extractBearer(request);
  if (!raw || !raw.startsWith('ald_ext_')) return null;

  const tokenHash = hashToken(raw);

  type PatRow = { id: string; user_id: string; revoked_at: Date | null };
  const rows = await prisma.$queryRaw<PatRow[]>`
    SELECT id, user_id, revoked_at
    FROM extension_access_tokens
    WHERE token_hash = ${tokenHash}
    LIMIT 1
  `;
  const row = rows[0] ?? null;

  if (!row || row.revoked_at) return null;

  // Fire-and-forget lastUsedAt update — don't block the response
  prisma.$executeRaw`
    UPDATE extension_access_tokens SET last_used_at = NOW() WHERE token_hash = ${tokenHash}
  `.catch(() => {});

  return { userId: row.user_id };
}
