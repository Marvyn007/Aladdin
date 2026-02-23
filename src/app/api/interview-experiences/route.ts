import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

// POST: Create a new interview experience
export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        const {
            companyName,
            role,
            location,
            workOption,
            offerStatus,
            salaryHourly,
            appliedDate,
            offerDate,
            processSteps,
            interviewDetails,
            additionalComments
        } = body;

        // Basic validation
        console.log('POST payload:', body);
        if (!companyName || !role || !location || !workOption || !offerStatus) {
            console.log('Validation failed:', { companyName, role, location, workOption, offerStatus });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Verify company exists
        const company = await prisma.company.findUnique({
            where: { name: companyName }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        const experience = await prisma.interviewExperience.create({
            data: {
                userId,
                companyName,
                role,
                location,
                workOption,
                offerStatus,
                salaryHourly: salaryHourly ? parseFloat(salaryHourly) : null,
                appliedDate: appliedDate ? new Date(appliedDate) : null,
                offerDate: offerDate ? new Date(offerDate) : null,
                processSteps: processSteps || [],
                interviewDetails: interviewDetails || {},
                additionalComments: additionalComments || null
            }
        });

        return NextResponse.json(experience);
    } catch (error) {
        console.error('Error creating interview experience:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

// GET: Fetch list of all companies with aggregated review stats
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const query = searchParams.get('q')?.toLowerCase() || '';
        const page = parseInt(searchParams.get('page') || '1', 10);
        const limit = parseInt(searchParams.get('limit') || '36', 10);

        const skip = (page - 1) * limit;

        // Fetch all companies with review counts and average salary
        const companiesFetched = await prisma.company.findMany({
            where: query ? {
                name: {
                    contains: query,
                    mode: 'insensitive'
                }
            } : {},
            include: {
                _count: {
                    select: {
                        interviewExperiences: true
                    }
                },
                interviewExperiences: {
                    select: {
                        salaryHourly: true
                    }
                }
            },
            orderBy: {
                name: 'asc'
            },
            skip,
            take: limit
        });

        const totalCount = await prisma.company.count({
            where: query ? {
                name: {
                    contains: query,
                    mode: 'insensitive'
                }
            } : {}
        });

        // Compute averages in memory
        const formattedCompanies = (companiesFetched as any[]).map(company => {
            const reviews = company.interviewExperiences || [];
            const validSalaries = reviews
                .map((r: any) => r.salaryHourly)
                .filter((s: any): s is number => s !== null && s !== undefined);

            const avgSalary = validSalaries.length > 0
                ? validSalaries.reduce((sum: number, val: number) => sum + val, 0) / validSalaries.length
                : null;

            return {
                name: company.name,
                logoUrl: company.logoUrl,
                reviewCount: company._count?.interviewExperiences || 0,
                avgSalaryHourly: avgSalary
            };
        });

        return NextResponse.json({
            companies: formattedCompanies,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (e: any) {
        console.error("GET interview-experiences error:", e);
        return NextResponse.json({ error: e.message || "Failed to fetch companies" }, { status: 500 });
    }
}
