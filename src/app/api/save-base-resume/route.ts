// src/app/api/save-base-resume/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { insertResume } from '@/lib/db';
import type { TailoredResumeData, ParsedResume } from '@/types';

export const runtime = 'nodejs';

function buildFilename(resumeData: TailoredResumeData): string {
  const name = (resumeData.contact?.name ?? '').trim();
  const parts = name.toLowerCase().split(/\s+/).filter(Boolean);
  const now = new Date();
  const month = now.toLocaleString('en-US', { month: 'long' }).toLowerCase();
  const year = now.getFullYear();

  if (parts.length >= 2) {
    return `${parts[0]}_${parts[parts.length - 1]}_${month}_${year}_resume`;
  }
  return `resume_${month}_${year}`;
}

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let resumeData: TailoredResumeData;
  try {
    const body = await request.json();
    if (!body.resumeData) throw new Error('Missing resumeData');
    resumeData = body.resumeData as TailoredResumeData;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  try {
    const filename = buildFilename(resumeData);
    // The parsed_json column is JSON/JSONB — any shape is valid at the DB level.
    // We store TailoredResumeData here so it can be round-tripped back to the editor later.
    const saved = await insertResume(
      userId,
      filename,
      resumeData as unknown as ParsedResume,
      false // not default — this is a versioned copy, not the canonical resume
    );
    return NextResponse.json({ success: true, id: saved.id, filename });
  } catch (err: unknown) {
    console.error('[save-base-resume] Error:', err);
    return NextResponse.json({ error: 'Failed to save resume.' }, { status: 500 });
  }
}
