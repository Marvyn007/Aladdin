#!/usr/bin/env node
/**
 * Data Migration Script: Supabase to Neon
 * 
 * This script migrates data from Supabase to Neon using Prisma
 * Run with: node scripts/migrate-data-to-neon.js
 */

const { Client } = require('pg');

// Database URLs from environment
const SUPABASE_URL = process.env.DATABASE_URL_SUPABASE ||
    'postgresql://aladdin_admin:BwyUdG2ACyX73Uq@aladdin.cfe8amgc0lns.us-east-2.rds.amazonaws.com:5432/aladdin';

const NEON_URL = process.env.DATABASE_URL ||
    'postgresql://neondb_owner:npg_i7WbTMx6CJXg@ep-aged-queen-aewp9acl-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require';

const TABLES = [
    'app_settings',
    'jobs',
    'resumes',
    'linkedin_profiles',
    'cover_letters',
    'applications',
];

async function main() {
    console.log('='.repeat(60));
    console.log('DATA MIGRATION: Supabase → Neon');
    console.log('='.repeat(60));
    console.log('');

    const sourceClient = new Client({ connectionString: SUPABASE_URL });
    const targetClient = new Client({ connectionString: NEON_URL });

    try {
        // Connect to both databases
        console.log('Connecting to databases...');
        await sourceClient.connect();
        console.log('  ✓ Connected to Supabase');
        await targetClient.connect();
        console.log('  ✓ Connected to Neon');
        console.log('');

        // Migrate each table
        for (const table of TABLES) {
            console.log(`Migrating: ${table}`);
            console.log('-'.repeat(40));

            // Get row count from source
            const countResult = await sourceClient.query(`SELECT COUNT(*) FROM ${table}`);
            const rowCount = parseInt(countResult.rows[0].count);
            console.log(`  Source rows: ${rowCount}`);

            if (rowCount === 0) {
                console.log('  ⚠️ No data to migrate');
                console.log('');
                continue;
            }

            // Fetch all data from source
            const dataResult = await sourceClient.query(`SELECT * FROM ${table}`);
            const rows = dataResult.rows;

            // Get column names
            const columns = Object.keys(rows[0]);
            const columnList = columns.join(', ');
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');

            // Insert into target (with upsert logic)
            let inserted = 0;
            let errors = 0;

            for (const row of rows) {
                const values = columns.map(col => row[col]);
                try {
                    await targetClient.query(
                        `INSERT INTO ${table} (${columnList}) VALUES (${placeholders})
             ON CONFLICT DO NOTHING`,
                        values
                    );
                    inserted++;
                } catch (err) {
                    errors++;
                    if (errors <= 3) {
                        console.log(`  ⚠️ Error inserting row: ${err.message}`);
                    }
                }
            }

            console.log(`  ✓ Inserted: ${inserted}/${rowCount}`);
            if (errors > 0) {
                console.log(`  ⚠️ Errors: ${errors}`);
            }
            console.log('');
        }

        // Verify migration
        console.log('='.repeat(60));
        console.log('VERIFICATION');
        console.log('='.repeat(60));
        console.log('');

        for (const table of TABLES) {
            const sourceCount = await sourceClient.query(`SELECT COUNT(*) FROM ${table}`);
            const targetCount = await targetClient.query(`SELECT COUNT(*) FROM ${table}`);

            const source = parseInt(sourceCount.rows[0].count);
            const target = parseInt(targetCount.rows[0].count);
            const match = source === target ? '✓' : '⚠️';

            console.log(`${match} ${table}: Supabase=${source}, Neon=${target}`);
        }

        console.log('');
        console.log('Migration complete!');

    } catch (error) {
        console.error('ERROR:', error);
        process.exit(1);
    } finally {
        await sourceClient.end();
        await targetClient.end();
    }
}

main();
