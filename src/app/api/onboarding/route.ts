import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
  getOnboardingSnapshot,
  saveOnboardingAnswers,
} from '@/lib/onboarding-db';
import { getQueue } from '@/lib/queue';

export const runtime = 'nodejs';

// GET /api/onboarding -> OnboardingSnapshot
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const snapshot = await getOnboardingSnapshot(userId);
    return NextResponse.json(snapshot);
  } catch (error) {
    console.error('[/api/onboarding GET]', error);
    return NextResponse.json({ error: 'Failed to load onboarding state' }, { status: 500 });
  }
}

// POST /api/onboarding { currentStep, complete?, answers } -> { success, ...OnboardingSnapshot }
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      currentStep: number;
      complete?: boolean;
      answers?: Array<{ questionKey: string; value: unknown }>;
    };

    const { currentStep, complete, answers = [] } = body;

    if (complete) {
      // Save answers and mark complete in one call
      const snapshot = await saveOnboardingAnswers(userId, answers, { currentStep, complete: true });
      // Fire-and-forget: enqueue background scoring for this user
      getQueue().enqueue({ type: 'score-user-preferences', payload: { userId }, priority: 2 }).catch(() => undefined);
      return NextResponse.json({ success: true, ...snapshot });
    }

    // Save answers and update current step
    const snapshot = await saveOnboardingAnswers(userId, answers, { currentStep });
    // Fire-and-forget: enqueue re-scoring on every preference save
    getQueue().enqueue({ type: 'score-user-preferences', payload: { userId }, priority: 2 }).catch(() => undefined);
    return NextResponse.json({ success: true, ...snapshot });
  } catch (error) {
    console.error('[/api/onboarding POST]', error);
    return NextResponse.json({ error: 'Failed to save onboarding answers' }, { status: 500 });
  }
}
