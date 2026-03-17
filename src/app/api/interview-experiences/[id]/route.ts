import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { validateInterviewExperience } from '@/lib/interview-validation';

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const body = await req.json();

        // 1. Fetch existing record to check ownership
        const existing = await prisma.interviewExperience.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Interview experience not found' }, { status: 404 });
        }

        if (existing.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // 2. Validation
        const validation = validateInterviewExperience(body);
        if (!validation.isValid) {
            return NextResponse.json({ 
                error: 'Validation failed', 
                details: validation.errors 
            }, { status: 400 });
        }

        // 3. Track History
        const currentHistory = (existing.editHistory as any[]) || [];
        const editEntry = {
            timestamp: new Date().toISOString(),
            editorId: userId,
            previousState: {
                role: existing.role,
                location: existing.location,
                salaryHourly: existing.salaryHourly,
                additionalComments: existing.additionalComments
            }
        };
        const updatedHistory = [...currentHistory, editEntry].slice(-10); // Keep last 10 edits

        const {
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

        // 4. Update
        const updated = await prisma.interviewExperience.update({
            where: { id },
            data: {
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
                outcome: outcome || existing.outcome,
                offerDetails: offerDetails || existing.offerDetails,
                isRemote: isRemote !== undefined ? isRemote : existing.isRemote,
                isFlagged: validation.isFlagged,
                lastEditedBy: userId,
                lastEditedAt: new Date(),
                editHistory: updatedHistory,
                moderationNotes: validation.moderationNotes.join('; ') || existing.moderationNotes
            }
        });

        return NextResponse.json(updated);
    } catch (error) {
        console.error('Error updating interview experience:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { userId } = await auth();
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { id } = await params;
        const existing = await prisma.interviewExperience.findUnique({
            where: { id }
        });

        if (!existing) {
            return NextResponse.json({ error: 'Interview experience not found' }, { status: 404 });
        }

        if (existing.userId !== userId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        await prisma.interviewExperience.delete({
            where: { id }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting interview experience:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
