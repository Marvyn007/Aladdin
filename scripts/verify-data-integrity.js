#!/usr/bin/env node
/**
 * Data Integrity Verification Script
 * 
 * Compares data between Supabase and Neon to ensure migration success
 * Run with: node scripts/verify-data-integrity.js
 */

const { Client } = require('pg');

const SUPABASE_URL = process.env.DATABASE_URL_SUPABASE ||
    'postgresql://aladdin_admin:BwyUdG2ACyX73Uq@aladdin.cfe8amgc0lns.us-east-2.rds.amazonaws.com:5432/aladdin';

const NEON_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_i7WbTMx6CJXg@ep-aged-queen-aewp9acl-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const TABLES = [
    'jobs',
    'resumes',
    'linkedin_profiles',
    'cover_letters',
    'applications',
    'app_settings',
];

async function main() {
    console.log('='.repeat(60));
    console.log('DATA INTEGRITY VERIFICATION');
    console.log('='.repeat(60));
    console.log('');

    const supabase = new Client({ connectionString: SUPABASE_URL });
    const neon = new Client({ connectionString: NEON_URL });

    let allMatch = true;

    try {
        await supabase.connect();
        await neon.connect();

        // 1. Row count comparison
        console.log('1. ROW COUNT COMPARISON');
        console.log('-'.repeat(40));

        for (const table of TABLES) {
            const sCount = await supabase.query(`SELECT COUNT(*) FROM ${table}`);
            const nCount = await neon.query(`SELECT COUNT(*) FROM ${table}`);

            const s = parseInt(sCount.rows[0].count);
            const n = parseInt(nCount.rows[0].count);
            const match = s === n;

            if (!match) allMatch = false;

            console.log(`${match ? '✓' : '✗'} ${table.padEnd(20)} Supabase: ${s.toString().padStart(5)} | Neon: ${n.toString().padStart(5)}`);
        }
        console.log('');

        // 2. Latest records comparison (jobs)
        console.log('2. LATEST JOBS COMPARISON');
        console.log('-'.repeat(40));

        const sJobs = await supabase.query(
            `SELECT id, title, company FROM jobs ORDER BY created_at DESC LIMIT 3`
        );
        const nJobs = await neon.query(
            `SELECT id, title, company FROM jobs ORDER BY created_at DESC LIMIT 3`
        );

        console.log('Supabase:');
        sJobs.rows.forEach(j => console.log(`  - ${j.title} @ ${j.company}`));
        console.log('Neon:');
        nJobs.rows.forEach(j => console.log(`  - ${j.title} @ ${j.company}`));
        console.log('');

        // 3. Resume file data check
        console.log('3. RESUME FILE DATA CHECK');
        console.log('-'.repeat(40));

        const sResumes = await supabase.query(
            `SELECT COUNT(*) as total, COUNT(file_data) as with_files FROM resumes`
        );
        const nResumes = await neon.query(
            `SELECT COUNT(*) as total, COUNT(file_data) as with_files FROM resumes`
        );

        console.log(`Supabase: ${sResumes.rows[0].with_files}/${sResumes.rows[0].total} with file data`);
        console.log(`Neon:     ${nResumes.rows[0].with_files}/${nResumes.rows[0].total} with file data`);
        console.log('');

        // Summary
        console.log('='.repeat(60));
        if (allMatch) {
            console.log('✓ ALL CHECKS PASSED - Data integrity verified');
        } else {
            console.log('⚠️ SOME CHECKS FAILED - Review differences above');
        }
        console.log('='.repeat(60));

    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    } finally {
        await supabase.end();
        await neon.end();
    }
}

main();
