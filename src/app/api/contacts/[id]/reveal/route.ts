import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { revealContactEmail, ContactNotFoundError } from '@/lib/contacts/reveal-contact';
import {
  ProspeoAuthError,
  ProspeoRateLimitError,
  ProspeoNotFoundError,
  ProspeoServiceError,
} from '@/lib/contacts/prospeo-client';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: contactId } = await params;

  try {
    const result = await revealContactEmail(contactId, userId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof ContactNotFoundError) return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    if (err instanceof ProspeoAuthError) return NextResponse.json({ error: 'Prospeo API key error' }, { status: 500 });
    if (err instanceof ProspeoRateLimitError) return NextResponse.json({ error: 'Rate limit exceeded, try again later' }, { status: 429 });
    if (err instanceof ProspeoNotFoundError) return NextResponse.json({ error: 'Contact not found in Prospeo' }, { status: 404 });
    if (err instanceof ProspeoServiceError) return NextResponse.json({ error: 'Prospeo service unavailable' }, { status: 502 });
    console.error('[contacts/reveal]', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
