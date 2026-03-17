import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const interviews = await prisma.interviewExperience.findMany({
            where: { userId },
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

        // Flatten company info for easier frontend consumption
        const formatted = interviews.map(item => ({
            ...item,
            companyName: item.company.name,
            companyLogo: item.company.logoUrl
        }));

        return NextResponse.json({ interviews: formatted });
    } catch (error) {
        console.error('Error fetching user interviews:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
