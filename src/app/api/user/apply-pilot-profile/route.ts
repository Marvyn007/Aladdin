import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

/** Always hit origin; Apply Pilot context must not be cached stale. */
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/prisma';
import {
  EMPTY_APPLY_PILOT_PAYLOAD,
  parseApplyPilotPayload,
  type ApplyPilotProfilePayload,
} from '@/lib/apply-pilot-profile/types';
import type { Prisma } from '@prisma/client';

function mergePayload(body: unknown): ApplyPilotProfilePayload {
  const base = { ...EMPTY_APPLY_PILOT_PAYLOAD };
  if (!body || typeof body !== 'object') return base;
  const o = body as Record<string, unknown>;
  const keys = Object.keys(base) as (keyof ApplyPilotProfilePayload)[];
  for (const k of keys) {
    if (typeof o[k] === 'string') base[k] = o[k] as string;
  }
  return base;
}

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const row = await prisma.applyPilotProfile.findUnique({
      where:  { userId },
      select: { payload: true, updatedAt: true },
    });
    const payload = parseApplyPilotPayload(row?.payload);

    return NextResponse.json({
      payload,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    });
  } catch (e) {
    console.error('[apply-pilot-profile GET]', e);
    return NextResponse.json({ error: 'Failed to load Apply Pilot profile' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const json = await request.json().catch(() => ({}));
    const payload = mergePayload(json.payload ?? json);
    const asJson = payload as unknown as Prisma.InputJsonValue;

    const row = await prisma.applyPilotProfile.upsert({
      where:  { userId },
      create: { userId, payload: asJson },
      update: { payload: asJson },
      select: { payload: true, updatedAt: true },
    });

    // Single-row upsert: DB reflects new answers before response returns (client awaits save).

    return NextResponse.json({
      ok:        true,
      payload:   parseApplyPilotPayload(row.payload),
      updatedAt: row.updatedAt.toISOString(),
    });
  } catch (e) {
    console.error('[apply-pilot-profile PUT]', e);
    return NextResponse.json({ error: 'Failed to save Apply Pilot profile' }, { status: 500 });
  }
}
