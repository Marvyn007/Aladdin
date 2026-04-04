import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function PATCH(_req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  await prisma.appSettings.upsert({
    where: { userId },
    update: { toured: true },
    create: { userId, toured: true },
  });

  return NextResponse.json({ success: true });
}
