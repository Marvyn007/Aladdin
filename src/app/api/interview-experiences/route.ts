import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { validateInterviewExperience } from '@/lib/interview-validation';

// POST: Create a new interview experience
export async function POST(req: Request) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const body = await req.json();
        
        // 1. Validation & Fraud Checks
        const validation = validateInterviewExperience(body);
        if (!validation.isValid) {
            return NextResponse.json({ 
                error: 'Validation failed', 
                details: validation.errors 
            }, { status: 400 });
        }

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
            additionalComments,
            outcome,
            offerDetails,
            isRemote
        } = body;

        // 2. Duplicate Detection (Simplified: Same user, same company, same role, same content)
        const existing = await prisma.interviewExperience.findFirst({
            where: {
                userId,
                companyName,
                role,
                additionalComments: additionalComments || null
            }
        });

        if (existing) {
            return NextResponse.json({ error: 'Duplicate entry detected' }, { status: 409 });
        }

        // 3. Verify company exists
        const company = await prisma.company.findUnique({
            where: { name: companyName }
        });

        if (!company) {
            return NextResponse.json({ error: 'Company not found' }, { status: 404 });
        }

        // 4. Create record
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
                additionalComments: additionalComments || null,
                
                // New fields
                outcome: outcome || 'Pending',
                offerDetails: offerDetails || null,
                isRemote: isRemote || false,
                isFlagged: validation.isFlagged,
                status: 'published',
                moderationNotes: validation.moderationNotes.join('; ') || null
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
        const sortBy = searchParams.get('sort_by') || 'most_reviews'; // Default to most_reviews

        const skip = (page - 1) * limit;

        const whereClause = query ? {
            OR: [
                { name: { contains: query, mode: 'insensitive' as const } },
                { 
                    interviewExperiences: {
                        some: {
                            OR: [
                                { role: { contains: query, mode: 'insensitive' as const } },
                                { location: { contains: query, mode: 'insensitive' as const } },
                                { additionalComments: { contains: query, mode: 'insensitive' as const } }
                            ]
                        }
                    }
                }
            ]
        } : {};

        // Fetch all matching companies
        const totalCount = await prisma.company.count({
            where: whereClause
        });

        // Fetch without skipping/limiting here because we need to sort by in-memory computed stats like avgSalary or reviewCount first.
        const allCompaniesFetched = await prisma.company.findMany({
            where: whereClause,
            include: {
                interviewExperiences: {
                    select: {
                        salaryHourly: true
                    }
                }
            }
        });

        // Compute averages and prepare for sorting
        const formattedCompanies = (allCompaniesFetched as any[]).map(company => {
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
                reviewCount: reviews.length,
                avgSalaryHourly: avgSalary
            };
        });

        // Apply sorting
        if (sortBy === 'most_reviews') {
            // First sort by reviews descending, then by name ascending for ties
            formattedCompanies.sort((a, b) => {
                if (b.reviewCount !== a.reviewCount) return b.reviewCount - a.reviewCount;
                return a.name.localeCompare(b.name);
            });
        } else if (sortBy === 'highest_pay') {
            formattedCompanies.sort((a, b) => {
                const payA = a.avgSalaryHourly || 0;
                const payB = b.avgSalaryHourly || 0;
                if (payB !== payA) return payB - payA;
                return a.name.localeCompare(b.name);
            });
        } else if (sortBy === 'a_z') {
            formattedCompanies.sort((a, b) => a.name.localeCompare(b.name));
        } else if (sortBy === 'z_a') {
            formattedCompanies.sort((a, b) => b.name.localeCompare(a.name));
        }

        // Apply pagination after sorting
        const paginatedCompanies = formattedCompanies.slice(skip, skip + limit);

        console.log(`Successfully fetched ${paginatedCompanies.length} companies for page ${page}`);

        return NextResponse.json({
            companies: paginatedCompanies,
            pagination: {
                page,
                limit,
                total: totalCount,
                totalPages: Math.ceil(totalCount / limit)
            }
        });
    } catch (e: any) {
        console.error("GET interview-experiences error detail:", {
            message: e.message,
            stack: e.stack,
            query: req.url
        });
        return NextResponse.json({ error: e.message || "Failed to fetch companies" }, { status: 500 });
    }
}
