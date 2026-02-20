/**
 * POST /api/resume/drip-question
 *
 * Expert Resume Rebuilder — Drip-Question Mode API
 *
 * Actions:
 *   { action: "start", parsedResume?: any }         → Start session, get first question
 *   { action: "answer", answer: string }             → Submit answer, get next question
 *   { action: "stop" }                               → Finalize and generate resume
 *   { action: "status" }                             → Get current session state
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import {
    startDripSession,
    submitDripAnswer,
    getDripSession,
    finalizeDripSession,
} from '@/lib/resume-drip-questions';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { action } = body;

        switch (action) {
            case 'start': {
                const result = startDripSession(userId, body.parsedResume || undefined);
                return NextResponse.json({
                    status: 'active',
                    sessionId: result.sessionId,
                    question: result.question,
                    totalQuestions: result.totalQuestions,
                });
            }

            case 'answer': {
                if (!body.answer || typeof body.answer !== 'string') {
                    return NextResponse.json(
                        { error: 'Answer is required and must be a string.' },
                        { status: 400 }
                    );
                }

                try {
                    const result = submitDripAnswer(userId, body.answer);
                    return NextResponse.json({
                        status: result.done ? 'complete' : 'active',
                        question: result.question || null,
                        questionsRemaining: result.questionsRemaining,
                    });
                } catch (err: any) {
                    return NextResponse.json(
                        { error: err.message },
                        { status: 400 }
                    );
                }
            }

            case 'stop': {
                try {
                    const result = finalizeDripSession(userId);
                    return NextResponse.json({
                        status: 'finalized',
                        parsedResume: result.parsedResume,
                        confidence: result.confidence,
                        message: 'Drip session finalized. Use /api/generate-tailored-resume with this parsed data to generate your resume.',
                    });
                } catch (err: any) {
                    return NextResponse.json(
                        { error: err.message },
                        { status: 400 }
                    );
                }
            }

            case 'status': {
                const session = getDripSession(userId);
                if (!session) {
                    return NextResponse.json({
                        status: 'none',
                        message: 'No active drip session. Use action: "start" to begin.',
                    });
                }

                return NextResponse.json({
                    status: session.status,
                    currentQuestionIndex: session.currentQuestionIndex,
                    totalQuestions: session.questions.length,
                    questionsRemaining: session.questions.length - session.currentQuestionIndex,
                    currentQuestion: session.status === 'active'
                        ? session.questions[session.currentQuestionIndex]
                        : null,
                });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown action: "${action}". Use "start", "answer", "stop", or "status".` },
                    { status: 400 }
                );
        }
    } catch (error: any) {
        console.error('[DripQuestion:API] Error:', error);
        return NextResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
        );
    }
}
