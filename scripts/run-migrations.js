#!/usr/bin/env node
/**
 * Run All Migrations Script
 * 
 * This script runs all migrations in order:
 * 1. Create users table + legacy user
 * 2. Add nullable user_id columns
 * 3. Backfill existing records
 * 4. Make user_id non-nullable with foreign keys
 * 
 * Run with: node scripts/run-migrations.js
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const MIGRATIONS_DIR = path.join(__dirname, '..', 'prisma', 'migrations');

const migrations = [
    '001_create_users_table.sql',
    '002_add_nullable_user_id.sql',
    '003_backfill_legacy_user.sql',
    '004_make_user_id_non_nullable.sql',
];

async function runMigration(filename) {
    const filepath = path.join(MIGRATIONS_DIR, filename);

    if (!fs.existsSync(filepath)) {
        console.log(`  ⚠️ Migration file not found: ${filename}`);
        return false;
    }

    console.log(`  Running: ${filename}`);
    try {
        execSync(`npx prisma db execute --file "${filepath}"`, {
            stdio: 'inherit',
            cwd: path.join(__dirname, '..'),
        });
        console.log(`  ✓ ${filename} completed`);
        return true;
    } catch (error) {
        console.error(`  ✗ ${filename} failed:`, error.message);
        return false;
    }
}

async function main() {
    console.log('='.repeat(60));
    console.log('RUNNING ALL MIGRATIONS');
    console.log('='.repeat(60));
    console.log('');

    for (const migration of migrations) {
        console.log(`\nMigration: ${migration}`);
        console.log('-'.repeat(40));

        const success = await runMigration(migration);

        if (!success) {
            console.error(`\n❌ Migration failed. Stopping.`);
            process.exit(1);
        }
    }

    console.log('');
    console.log('='.repeat(60));
    console.log('ALL MIGRATIONS COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60));
    console.log('');
    console.log('Next: Regenerate Prisma client');
    console.log('  npx prisma generate');
}

main().catch(console.error);
