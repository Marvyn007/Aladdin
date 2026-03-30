import { NextResponse } from 'next/server';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const difficulty = searchParams.get('difficulty') || '';
    const sortBy = searchParams.get('sortBy') || 'popularity'; // 'popularity', 'difficulty', 'acceptance'

    try {
        const where: Prisma.LeetCodeQuestionWhereInput = {
            AND: [
                search ? {
                    OR: [
                        { title: { contains: search, mode: 'insensitive' } },
                        { number: parseInt(search) || undefined }
                    ]
                } : {},
                difficulty ? { difficulty: { equals: difficulty, mode: 'insensitive' } } : {}
            ]
        };

        // Fetch questions with their company associations (including company names)
        const questions = await prisma.leetCodeQuestion.findMany({
            where,
            include: {
                companies: {
                    select: {
                        companyName: true
                    }
                },
                _count: {
                    select: { companies: true }
                }
            }
        });

        // Map and Sort
        let result = questions.map(q => ({
            id: q.id,
            number: q.number,
            title: q.title,
            url: q.url,
            difficulty: q.difficulty,
            acceptanceRate: q.acceptanceRate,
            companyCount: q._count.companies,
            companyNames: q.companies.map(c => c.companyName)
        }));

        const sortDir = searchParams.get('sortDir') || 'desc';

        if (sortBy === 'popularity') {
            result.sort((a, b) => sortDir === 'desc' ? b.companyCount - a.companyCount : a.companyCount - b.companyCount);
        } else if (sortBy === 'difficulty') {
            const levelMap: Record<string, number> = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
            result.sort((a, b) => {
                const valA = levelMap[a.difficulty] || 0;
                const valB = levelMap[b.difficulty] || 0;
                return sortDir === 'desc' ? valB - valA : valA - valB;
            });
        } else if (sortBy === 'acceptance') {
            result.sort((a, b) => {
                const valA = a.acceptanceRate || 0;
                const valB = b.acceptanceRate || 0;
                return sortDir === 'desc' ? valB - valA : valA - valB;
            });
        }

        return NextResponse.json(result);
    } catch (error: any) {
        console.error('Error fetching practice questions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
