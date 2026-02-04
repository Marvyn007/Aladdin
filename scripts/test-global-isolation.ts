
import { getJobById, getJobs, insertJob, updateJobStatus } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

// Mock DB for testing isolation logic (conceptually)
// In a real environment, we'd cycle the DB or use a test DB.
// Since we can't easily spin up a fresh DB here, we'll write a script 
// that simulates the flows using the actual DB functions but with test IDs.

async function testGlobalJobsIsolation() {
    console.log('🧪 Starting Global Jobs Isolation Test...');

    const userA = `test_user_A_${uuidv4()}`;
    const userB = `test_user_B_${uuidv4()}`;

    // 1. User A imports a Job
    const jobData = {
        title: `Test Job ${uuidv4()}`,
        company: 'Test Corp',
        location: 'Remote',
        source_url: `https://test.com/${uuidv4()}`,
        posted_at: new Date().toISOString(),
        normalized_text: 'Test description',
        raw_text_summary: 'Test description',
        isImported: true
    };

    console.log(`[Step 1] User A importing job: ${jobData.title}`);
    const jobA = await insertJob(userA, jobData);
    console.log(`✅ Job imported with ID: ${jobA.id}`);

    // 2. User B tries to read the job (Public Read)
    console.log(`[Step 2] User B (or Public) reading job ${jobA.id}...`);
    const jobPublic = await getJobById(null, jobA.id);

    if (jobPublic && jobPublic.id === jobA.id) {
        console.log('✅ Public read successful: Job found.');
    } else {
        console.error('❌ Public read failed: Job not found.');
    }

    // 3. Check User A has "fresh" status
    console.log(`[Step 3] Verifying User A status...`);
    const jobAsSeenByA = await getJobById(userA, jobA.id);
    // Note: getJobById returns hydrated object. In real implementation we check status property if joined.
    // Our Typescript Job interface has status: JobStatus.
    // The DB function populates it from user_jobs.
    // If not found in user_jobs, it might be undefined or default?
    // Our join logic: LEFT JOIN. If match, we get status.
    // Wait, if I call getJobById(userB, jobA.id) and User B hasn't imported it, what happens?
    // The LEFT JOIN returns NULL for status.
    // The Job interface defines status as MANDATORY 'fresh' | 'archived'.
    // Existing code might break if status is null!

    // CRITICAL CHECK: Does getJobById handle null status?
    // My implementation: `matches: row.status`.
    // If null, we might need a default?
    // The prompt: "Make jobs ... visible to all users".
    // If User B views a job they haven't imported, is it 'fresh'?
    // Visually, yes. But logically, they have no relationship.

    console.log(`   User A Status: ${(jobAsSeenByA as any).status}`);

    // 4. User B reads job (Private Scope Check)
    console.log(`[Step 4] User B reading same job...`);
    const jobAsSeenByB = await getJobById(userB, jobA.id);

    if (jobAsSeenByB) {
        console.log(`   User B sees job. Status: ${(jobAsSeenByB as any).status}`);
        if (!(jobAsSeenByB as any).status) {
            console.log('✅ User B sees job but has NO status (correct isolation)');
        } else {
            console.error('❌ User B sees status? Should be null/undefined.');
        }
    } else {
        console.error('❌ User B cannot see global job?');
    }

    // 5. User A archives job
    console.log(`[Step 5] User A archiving job...`);
    await updateJobStatus(userA, jobA.id, 'archived');
    const jobA_Archived = await getJobById(userA, jobA.id);
    if ((jobA_Archived as any).status === 'archived') {
        console.log('✅ User A archived successfully.');
    } else {
        console.error('❌ Archive failed.');
    }

    // 6. User B should still see it (Global) and NOT archived
    const jobB_AfterArchive = await getJobById(userB, jobA.id);
    if (jobB_AfterArchive && !(jobB_AfterArchive as any).status) {
        console.log('✅ User B still sees job without archive status.');
    } else {
        console.error(`❌ User B sees status ${(jobB_AfterArchive as any)?.status} (Should be null)`);
    }

    console.log('Tests Completed.');
}

testGlobalJobsIsolation().catch(console.error);
