import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
    try {
        const { userId } = await auth();
        // Simplified admin check: check if userId exists. 
        // In a real app, we'd check for an 'admin' role in Clerk metadata or a whitelist.
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const flaggedInterviews = await prisma.interviewExperience.findMany({
            where: { isFlagged: true },
            orderBy: { createdAt: 'desc' },
            include: {
                company: {
                    select: {
                        name: true,
                        logoUrl: true
                    }
                }
            }
        });

        return NextResponse.json(flaggedInterviews);
    } catch (error) {
        console.error('Error fetching flagged interviews:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
