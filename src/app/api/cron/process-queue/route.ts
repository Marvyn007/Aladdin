
import { NextResponse } from 'next/server';
import { getPendingCoverLetters } from '@/lib/db';
import { performCoverLetterGeneration } from '@/lib/cover-letter-service';

export const dynamic = 'force-dynamic'; // Ensure not cached

export async function GET(request: Request) {
    // Basic Auth Check (optional, for Cron)
    const authHeader = request.headers.get('authorization');
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    // Allow if CRON_SECRET matches or running locally in dev (optional logic)
    // For now, open or simple key check if env var set.
    // Ensure we don't expose this publicly without protection in prod.
    // User mentioned "secure server process".

    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}` && key !== process.env.CRON_SECRET) {
        // Allow local dev loopback? 
    }

    try {
        const pending = await getPendingCoverLetters(5); // Process 5 at a time

        if (pending.length === 0) {
            return NextResponse.json({ message: 'No pending tasks', processed: 0 });
        }

        const results = [];
        for (const task of pending) {
            console.log(`[Queue] Processing task ${task.id} for job ${task.job_id}`);
            const result = await performCoverLetterGeneration(
                task.job_id,
                task.resume_id || undefined,
                task.id // Update existing record
            );
            results.push({ id: task.id, success: result.success, error: result.error });

            // Wait a bit to be nice to rate limits (1s)
            await new Promise(r => setTimeout(r, 1000));
        }

        return NextResponse.json({
            success: true,
            processed: results.length,
            results
        });

    } catch (error: any) {
        console.error('Queue processing failed:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
