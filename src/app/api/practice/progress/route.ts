import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const progress = await prisma.userLeetCodeProgress.findMany({
            where: { userId },
            select: { questionId: true, status: true }
        });

        // Return a set-like array or map of completed question IDs
        const completedIds = progress
            .filter(p => p.status === 'completed')
            .map(p => p.questionId);

        return NextResponse.json({ completedIds });
    } catch (error: any) {
        console.error('Error fetching practice progress:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { questionId, status } = body;

        if (!questionId) {
            return NextResponse.json({ error: 'questionId is required' }, { status: 400 });
        }

        // status boolean: true for completed, false for incomplete (removing it)
        if (status) {
            await prisma.userLeetCodeProgress.upsert({
                where: {
                    userId_questionId: {
                        userId,
                        questionId
                    }
                },
                update: {
                    status: 'completed',
                    completedAt: new Date()
                },
                create: {
                    userId,
                    questionId,
                    status: 'completed'
                }
            });
        } else {
            await prisma.userLeetCodeProgress.deleteMany({
                where: {
                    userId,
                    questionId
                }
            });
        }

        return NextResponse.json({ success: true, questionId, status });
    } catch (error: any) {
        console.error('Error updating practice progress:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
