'use server'

import { logInteraction, updateJobStatus } from './db';
import { auth } from '@clerk/nextjs/server';
import type { JobStatus } from '@/types';

export async function trackJobInteraction(jobId: string, type: string, metadata: any = {}) {
    const { userId } = await auth();
    if (userId) {
        await logInteraction(userId, jobId, type, metadata);
    }
}

export async function toggleJobStatusAction(jobId: string, status: JobStatus) {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    await updateJobStatus(userId, jobId, status);

    if (status === 'saved') {
        await logInteraction(userId, jobId, 'save', { source: 'toggle_button' });
    }
}
