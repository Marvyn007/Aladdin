import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

 
export async function GET(
    request: Request,
    { params }: { params: Promise<{ companyName: string }> }
) {
    const { companyName: rawCompanyName } = await params;
    const companyName = decodeURIComponent(rawCompanyName);

    try {
        const questions = await prisma.companyLeetCodeQuestion.findMany({
            where: {
                companyName: {
                    equals: companyName,
                    mode: 'insensitive'
                }
            },
            include: {
                question: {
                    include: {
                        _count: {
                            select: { companies: true }
                        }
                    }
                }
            },
            orderBy: {
                frequency: 'desc'
            }
        });

        const result = questions.map(q => ({
            id: q.question.id,
            number: q.question.number,
            title: q.question.title,
            url: q.question.url,
            difficulty: q.question.difficulty,
            acceptanceRate: q.question.acceptanceRate,
            frequency: q.question._count.companies
        }));

        // Fetch company logo from the DB exactly as done on the practice page
        let logoUrl: string | null = null;
        let domain: string | null = null;
        
        const dbCompany = await prisma.company.findFirst({
            where: {
                OR: [
                    { name: { equals: companyName, mode: 'insensitive' } },
                    { name: { equals: companyName.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '), mode: 'insensitive' } }
                ]
            },
            select: { logoUrl: true, domain: true }
        });

        const slug = companyName.toLowerCase();
        domain = dbCompany?.domain || null;
        logoUrl = dbCompany?.logoUrl || null;



        return NextResponse.json({
            questions: result,
            companyInfo: {
                logoUrl,
                domain
            }
        });
    } catch (error: any) {
        console.error('Error fetching company-specific questions:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
