import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ toured: true }); // treat unauthenticated as toured (hide button)
  }

  const settings = await prisma.appSettings.findUnique({
    where: { userId },
    select: { toured: true },
  });

  // No row yet = brand new user = not toured
  return NextResponse.json({ toured: settings?.toured ?? false });
}
