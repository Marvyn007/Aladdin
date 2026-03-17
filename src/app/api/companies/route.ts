import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('search') || '';

        if (search.length < 2) {
            return NextResponse.json([]);
        }

        const companies = await prisma.company.findMany({
            where: {
                name: {
                    contains: search,
                    mode: 'insensitive'
                }
            },
            take: 8,
            select: {
                id: true,
                name: true,
                logoUrl: true,
                domain: true
            }
        });

        return NextResponse.json(companies);
    } catch (error) {
        console.error('Error fetching companies:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
