#!/usr/bin/env node
/**
 * Backfill Script: Assign Legacy User to Existing Records
 * 
 * This script:
 * 1. Creates the legacy user in the users table
 * 2. Backfills all existing records with the legacy user ID
 * 3. Verifies the backfill was successful
 * 
 * Run with: node scripts/backfill-legacy-user.js
 * Or: npx ts-node scripts/backfill-legacy-user.ts
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEGACY_USER_ID = 'legacy_user_001';
const LEGACY_USER_EMAIL = 'legacy@aladdin.local';
const LEGACY_USER_NAME = 'Legacy User (Pre-Auth Data)';

async function main() {
    console.log('='.repeat(60));
    console.log('BACKFILL SCRIPT: Assigning Legacy User to Existing Records');
    console.log('='.repeat(60));
    console.log('');

    try {
        // Step 1: Create or verify legacy user exists
        console.log('Step 1: Creating/verifying legacy user...');
        await prisma.$executeRawUnsafe(`
      INSERT INTO users (id, email, name, created_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (id) DO NOTHING
    `, LEGACY_USER_ID, LEGACY_USER_EMAIL, LEGACY_USER_NAME);
        console.log(`  ✓ Legacy user "${LEGACY_USER_ID}" ready`);
        console.log('');

        // Step 2: Count existing records before backfill
        console.log('Step 2: Counting records to backfill...');
        const counts = {
            jobs: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM jobs WHERE user_id IS NULL`),
            resumes: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM resumes WHERE user_id IS NULL`),
            linkedin: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM linkedin_profiles WHERE user_id IS NULL`),
            coverLetters: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM cover_letters WHERE user_id IS NULL`),
            applications: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM applications WHERE user_id IS NULL`),
            appSettings: await prisma.$executeRawUnsafe(`SELECT COUNT(*) FROM app_settings WHERE user_id IS NULL`),
        };
        console.log('  Records with NULL user_id:');
        Object.entries(counts).forEach(([table, count]) => {
            console.log(`    - ${table}: ${count} records`);
        });
        console.log('');

        // Step 3: Backfill each table
        console.log('Step 3: Backfilling records with legacy user...');

        const jobsUpdated = await prisma.$executeRawUnsafe(
            `UPDATE jobs SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ jobs: ${jobsUpdated} records updated`);

        const resumesUpdated = await prisma.$executeRawUnsafe(
            `UPDATE resumes SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ resumes: ${resumesUpdated} records updated`);

        const linkedinUpdated = await prisma.$executeRawUnsafe(
            `UPDATE linkedin_profiles SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ linkedin_profiles: ${linkedinUpdated} records updated`);

        const coverLettersUpdated = await prisma.$executeRawUnsafe(
            `UPDATE cover_letters SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ cover_letters: ${coverLettersUpdated} records updated`);

        const applicationsUpdated = await prisma.$executeRawUnsafe(
            `UPDATE applications SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ applications: ${applicationsUpdated} records updated`);

        const appSettingsUpdated = await prisma.$executeRawUnsafe(
            `UPDATE app_settings SET user_id = $1 WHERE user_id IS NULL`, LEGACY_USER_ID
        );
        console.log(`  ✓ app_settings: ${appSettingsUpdated} records updated`);
        console.log('');

        // Step 4: Verify no NULL user_ids remain
        console.log('Step 4: Verifying backfill...');
        const nullCounts = await prisma.$queryRawUnsafe(`
      SELECT 
        (SELECT COUNT(*) FROM jobs WHERE user_id IS NULL) as jobs_null,
        (SELECT COUNT(*) FROM resumes WHERE user_id IS NULL) as resumes_null,
        (SELECT COUNT(*) FROM linkedin_profiles WHERE user_id IS NULL) as linkedin_null,
        (SELECT COUNT(*) FROM cover_letters WHERE user_id IS NULL) as cover_letters_null,
        (SELECT COUNT(*) FROM applications WHERE user_id IS NULL) as applications_null,
        (SELECT COUNT(*) FROM app_settings WHERE user_id IS NULL) as app_settings_null
    `);

        const nullResult = nullCounts[0];
        const hasNulls = Object.values(nullResult).some(v => parseInt(v) > 0);

        if (hasNulls) {
            console.log('  ⚠️ WARNING: Some records still have NULL user_id:');
            Object.entries(nullResult).forEach(([col, count]) => {
                if (parseInt(count) > 0) {
                    console.log(`    - ${col}: ${count}`);
                }
            });
        } else {
            console.log('  ✓ All records have been assigned to the legacy user');
        }
        console.log('');

        // Summary
        console.log('='.repeat(60));
        console.log('BACKFILL COMPLETE');
        console.log('='.repeat(60));
        console.log('');
        console.log('Total records updated:');
        console.log(`  - jobs: ${jobsUpdated}`);
        console.log(`  - resumes: ${resumesUpdated}`);
        console.log(`  - linkedin_profiles: ${linkedinUpdated}`);
        console.log(`  - cover_letters: ${coverLettersUpdated}`);
        console.log(`  - applications: ${applicationsUpdated}`);
        console.log(`  - app_settings: ${appSettingsUpdated}`);
        console.log('');
        console.log('Next step: Run migration 004 to make user_id NOT NULL');
        console.log('  npx prisma db execute --file prisma/migrations/004_make_user_id_non_nullable.sql');

    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
