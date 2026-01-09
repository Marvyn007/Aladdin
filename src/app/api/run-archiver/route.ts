// API Route: POST /api/run-archiver
// Run the archiver agent to archive old jobs and purge old archives

import { NextResponse } from 'next/server';
import { archiveOldJobs, purgeOldArchives } from '@/lib/db';

export async function POST() {
    try {
        // Archive jobs older than 24 hours
        const archivedCount = await archiveOldJobs();

        // Purge archives older than 7 days
        const purgedCount = await purgeOldArchives();

        return NextResponse.json({
            success: true,
            archived: archivedCount,
            purged: purgedCount,
            timestamp: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error running archiver:', error);
        return NextResponse.json(
            { error: 'Failed to run archiver' },
            { status: 500 }
        );
    }
}
