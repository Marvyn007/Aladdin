/**
 * Example: Get all jobs for authenticated user
 * Demonstrates userId-scoped database queries with Clerk auth
 */

import { NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { insertJob } from '@/lib/db';

export async function GET(request: Request) {
    try {
        // Get authenticated userId from Clerk
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized: Please sign in to access your jobs' },
                { status: 401 }
            );
        }

        // Parse query parameters
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'fresh';
        const limit = parseInt(searchParams.get('limit') || '300', 10);

        // Query UserJobs to get user-specific status/score
        // and include Global Job details
        const userJobs = await prisma.userJob.findMany({
            where: {
                userId: userId,
                status: status,
            },
            include: {
                job: true, // Join global job data
            },
            orderBy: [
                { matchScore: 'desc' },
                { createdAt: 'desc' },
            ],
            take: limit,
        });

        // Flatten result to look like a Job with status
        const jobs = userJobs.map(uj => ({
            ...uj.job,
            status: uj.status,
            matchScore: uj.matchScore,
            matchedSkills: uj.matched_skills, // DB field name
        }));

        return NextResponse.json({
            success: true,
            count: jobs.length,
            jobs,
        });

    } catch (error) {
        console.error('Error fetching jobs:', error);
        return NextResponse.json(
            { error: 'Failed to fetch jobs' },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        // Get authenticated userId from Clerk
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 401 }
            );
        }

        const body = await request.json();

        const user = await currentUser();
        const posterDetails = user ? {
            firstName: user.firstName,
            lastName: user.lastName,
            imageUrl: user.imageUrl
        } : undefined;

        // Use the centralized insert logic to handle Global/User split correctly
        const job = await insertJob(userId, {
            title: body.title,
            company: body.company,
            location: body.location,
            source_url: body.sourceUrl,
            normalized_text: body.normalizedText,
            raw_text_summary: body.rawTextSummary,
            posted_at: new Date().toISOString(),
        }, posterDetails);

        return NextResponse.json({
            success: true,
            job,
        });

    } catch (error) {
        console.error('Error creating job:', error);
        return NextResponse.json(
            { error: 'Failed to create job' },
            { status: 500 }
        );
    }
}
