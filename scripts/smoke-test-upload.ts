
import { executeWithUser, getPostgresPool, closePostgresPool } from '../src/lib/postgres';
import { insertResume, getResumes, deleteResume, getResumeMetadata } from '../src/lib/db';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
dotenv.config();

async function smokeTest() {
    console.log('Starting Smoke Test for Uploads & RLS...');
    const userId = 'smoke-user-' + uuidv4().substring(0, 8);
    const userId2 = 'smoke-attacker-' + uuidv4().substring(0, 8);
    const pool = getPostgresPool();

    try {
        // Step 1: Simulate Upload (Insert Resume)
        // This implicitly tests:
        // a) executeWithUser
        // b) user upsert (FK check)
        // c) set_config (RLS) policies allowing INSERT
        console.log(`[1] Uploading resume for ${userId}...`);

        // Mock file buffer
        const buffer = Buffer.from('fake-pdf-content');

        const resume = await insertResume(
            userId,
            'test-resume.pdf',
            { skills: ['typescript'] } as any,
            true,
            undefined // Skip S3 upload to test DB/RLS logic without AWS creds
        );
        console.log('Resume inserted:', resume.id);

        // Step 2: Verify Visibility (Owner)
        console.log(`[2] Verifying visibility for owner ${userId}...`);
        const resumes = await getResumes(userId);
        const savedResume = resumes.find(r => r.id === resume.id);

        if (savedResume) {
            console.log('SUCCESS: Owner can see resume.');
        } else {
            console.error('FAILURE: Owner CANNOT see resume (RLS or Insert failed).');
            process.exit(1);
        }

        // Step 3: Verify Isolation (Attacker)
        console.log(`[3] Verifying isolation for attacker ${userId2}...`);
        // We expect an empty list, NOT an error, because RLS hides rows
        const attackerResumes = await getResumes(userId2);

        if (attackerResumes.length === 0) {
            console.log('SUCCESS: Attacker verifies 0 resumes.');
        } else {
            console.error(`FAILURE: Attacker can see ${attackerResumes.length} resumes!`);
            process.exit(1);
        }

        // Step 4: Verify getResumeMetadata (Preview logic)
        console.log(`[4] Verifying getResumeMetadata...`);
        const fetched = await getResumeMetadata(userId, resume.id);
        if (fetched && fetched.id === resume.id) {
            console.log('SUCCESS: getResumeMetadata worked');
        } else {
            console.error('FAILURE: getResumeMetadata returned null or wrong ID');
            process.exit(1);
        }

        // Step 5: Verify Soft Delete
        console.log(`[5] Soft Deleting & Verifying...`);
        await deleteResume(userId, resume.id);

        const listAfter = await getResumes(userId);
        if (listAfter.find(r => r.id === resume.id)) {
            console.error('FAILURE: Resume still visible after delete');
            process.exit(1);
        } else {
            console.log('SUCCESS: Resume list empty after delete.');
        }

        const fetchedAfter = await getResumeMetadata(userId, resume.id);
        if (fetchedAfter) {
            console.error('FAILURE: getResumeMetadata still returns deleted resume');
            process.exit(1);
        } else {
            console.log('SUCCESS: getResumeMetadata respects soft delete.');
        }

        // Cleaning up (optional, good for repeated runs if we didn't use random IDs)
        // But since we use random IDs, we can leave them or clean them.
        // Let's clean the main user
        console.log(`[6] Cleaning up...`);
        await executeWithUser(userId, async (client) => {
            await client.query('DELETE FROM users WHERE id = $1', [userId]);
        });
        await executeWithUser(userId2, async (client) => {
            await client.query('DELETE FROM users WHERE id = $1', [userId2]);
        });

        console.log('Smoke Test Passed!');

    } catch (e) {
        console.error('Smoke Test FAILURE:', e);
        process.exit(1);
    } finally {
        await closePostgresPool();
    }
}

smokeTest();
