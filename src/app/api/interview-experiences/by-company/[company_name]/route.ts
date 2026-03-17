import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
    req: Request,
    { params }: { params: Promise<{ company_name: string }> }
) {
    try {
        const { company_name } = await params;
        const companyName = company_name;

        if (!companyName) {
            return NextResponse.json({ error: 'Company name required' }, { status: 400 });
        }

        // Fetch company details
        const company = await prisma.company.findUnique({
            where: { name: companyName },
            select: {
                name: true,
                logoUrl: true
            }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // Fetch experiences
        const experiences = await prisma.interviewExperience.findMany({
            where: { companyName },
            orderBy: { createdAt: 'desc' },
            include: {
                user: {
                    select: {
                        firstName: true,
                        lastName: true,
                        imageUrl: true
                    }
                }
            }
        });

        // Compute average salary
        let avgSalaryHourly = null;
        let salarySum = 0;
        let salaryCount = 0;

        for (const exp of experiences) {
            if (exp.salaryHourly) {
                salarySum += exp.salaryHourly;
                salaryCount++;
            }
        }

        if (salaryCount > 0) {
            avgSalaryHourly = salarySum / salaryCount;
        }

        return NextResponse.json({
            company,
            stats: {
                reviewCount: experiences.length,
                avgSalaryHourly
            },
            experiences
        });
    } catch (error) {
        console.error('Error fetching company experiences:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
