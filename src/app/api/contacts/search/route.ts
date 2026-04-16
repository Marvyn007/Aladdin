import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { searchContacts } from '@/lib/contacts/search-contacts';
import {
  ApolloAuthError,
  ApolloRateLimitError,
  ApolloServiceError,
} from '@/lib/contacts/apollo-client';

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json();
  const { companyDomain, jobFunction, managementLevel, country, page = 1 } = body as {
    companyDomain?: string;
    jobFunction?: string;
    managementLevel?: string;
    country?: string;
    page?: number;
  };

  if (!companyDomain) {
    return NextResponse.json({ error: 'companyDomain is required' }, { status: 400 });
  }

  try {
    const result = await searchContacts({ companyDomain, jobFunction, managementLevel, country, page });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ApolloAuthError) return NextResponse.json({ error: 'Apollo configuration error' }, { status: 500 });
    if (err instanceof ApolloRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ApolloServiceError) return NextResponse.json({ error: 'Apollo service unavailable' }, { status: 502 });
    console.error('[contacts/search]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
