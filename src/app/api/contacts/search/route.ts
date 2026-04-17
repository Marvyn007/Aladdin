import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchContacts } from '@/lib/contacts/search-contacts';
import { checkAndIncrement } from '@/lib/subscription/check-usage';
import {
  ProspeoAuthError,
  ProspeoRateLimitError,
  ProspeoServiceError,
} from '@/lib/contacts/prospeo-client';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const usageGuard = await checkAndIncrement(userId, 'linkedinRetrieved');
  if (!usageGuard.allowed) {
    return NextResponse.json({ error: 'LinkedIn retrieval limit reached. Please upgrade your plan.' }, { status: 403 });
  }

  const body = await request.json();
  const { companyDomain } = body as { companyDomain?: string };

  if (!companyDomain?.trim()) {
    return NextResponse.json({ error: 'companyDomain is required' }, { status: 400 });
  }

  try {
    const result = await searchContacts({ companyDomain: companyDomain.trim() });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ProspeoAuthError) return NextResponse.json({ error: 'Prospeo API key error: ' + (err as Error).message }, { status: 500 });
    if (err instanceof ProspeoRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ProspeoServiceError) return NextResponse.json({ error: 'Prospeo service unavailable' }, { status: 502 });
    console.error('[contacts/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
