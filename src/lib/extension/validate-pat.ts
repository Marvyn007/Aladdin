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

  const row = await prisma.extensionAccessToken.findUnique({
    where:  { tokenHash },
    select: { id: true, userId: true, revokedAt: true },
  });

  if (!row || row.revokedAt) return null;

  // Fire-and-forget lastUsedAt update — don't block the response
  prisma.extensionAccessToken.update({
    where: { tokenHash },
    data:  { lastUsedAt: new Date() },
  }).catch(() => {});

  return { userId: row.userId };
}
