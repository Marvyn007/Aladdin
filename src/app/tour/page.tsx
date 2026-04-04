import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { TourClient } from './TourClient';

export const dynamic = 'force-dynamic';

export default async function TourPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect('/sign-in');
  }

  const settings = await prisma.appSettings.findUnique({
    where: { userId },
    select: { toured: true },
  });

  if (settings?.toured === true) {
    redirect('/');
  }

  return <TourClient />;
}
