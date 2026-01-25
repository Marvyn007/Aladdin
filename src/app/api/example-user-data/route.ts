/**
 * Example: Get user's resumes and applications
 * Demonstrates userId-scoped queries for multiple tables
 */

import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import prisma from '@/lib/prisma';

// GET /api/example-user-data - Fetch all user data
export async function GET() {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch all user-scoped data in parallel
        const [resumes, applications, coverLetters, settings] = await Promise.all([
            // Get user's resumes
            prisma.resume.findMany({
                where: { userId },
                orderBy: { createdAt: 'desc' },
            }),

            // Get user's applications with related data
            prisma.application.findMany({
                where: {
                    userId,
                    deleted: false,
                },
                include: {
                    job: true,
                    coverLetter: true,
                },
                orderBy: { appliedAt: 'desc' },
            }),

            // Get user's cover letters
            prisma.coverLetter.findMany({
                where: { userId },
                orderBy: { generatedAt: 'desc' },
            }),

            // Get user's settings (or create default)
            prisma.appSettings.upsert({
                where: { userId },
                create: {
                    userId,
                    freshLimit: 300,
                    excludedKeywords: [],
                },
                update: {},
            }),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                resumes,
                applications,
                coverLetters,
                settings,
            },
        });

    } catch (error) {
        console.error('Error fetching user data:', error);
        return NextResponse.json(
            { error: 'Failed to fetch user data' },
            { status: 500 }
        );
    }
}

// DELETE /api/example-user-data - Delete specific user data (example)
export async function DELETE(request: Request) {
    try {
        const { userId } = await auth();

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const id = searchParams.get('id');

        if (!type || !id) {
            return NextResponse.json(
                { error: 'Missing type or id parameter' },
                { status: 400 }
            );
        }

        // Delete with userId check to prevent unauthorized access
        switch (type) {
            case 'job':
            case 'job':
                await prisma.userJob.deleteMany({
                    where: { jobId: id, userId }, // <-- Delete user-job link
                });
                break;

            case 'resume':
                await prisma.resume.deleteMany({
                    where: { id, userId },
                });
                break;

            case 'application':
                await prisma.application.updateMany({
                    where: { id, userId },
                    data: { deleted: true },
                });
                break;

            default:
                return NextResponse.json(
                    { error: 'Invalid type' },
                    { status: 400 }
                );
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Error deleting data:', error);
        return NextResponse.json(
            { error: 'Failed to delete data' },
            { status: 500 }
        );
    }
}
