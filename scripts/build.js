// Trigger Vercel Build (TS Fix & Script Cleanup v1.1)
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local if present
const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
    require('dotenv').config({ path: envLocalPath });
    console.log('✅ Loaded environment variables from .env.local');
} else {
    console.log('⚠️ .env.local not found, relying on system environment variables');
}

try {
    console.log('--- 1. Validating Environment ---');
    execSync('node scripts/validate-env.js', { stdio: 'inherit' });

    console.log('\n--- 2. Generating Prisma Client ---');
    execSync('npx prisma generate', { stdio: 'inherit' });

    console.log('\n--- 3. Deploying Migrations ---');
    // Migrations are skipped by default during Vercel builds.
    //
    // Reason: prisma migrate deploy requires an advisory lock on a direct
    // (non-pooled) connection. On Neon's free tier the database suspends when
    // idle; the cold-start wake-up exceeds Prisma's 10-second lock timeout and
    // kills the build even when DIRECT_URL is correctly configured.
    //
    // Migrations should be run as a one-off command when you actually have
    // pending schema changes:
    //
    //   DIRECT_URL=<non-pooled-neon-url> npx prisma migrate deploy
    //
    // To opt-in to running migrations during the build set RUN_MIGRATIONS=true
    // in your Vercel environment variables.

    const runMigrations = process.env.RUN_MIGRATIONS === 'true';

    if (!runMigrations) {
        console.log('⏭️  Skipping prisma migrate deploy (default). Set RUN_MIGRATIONS=true to enable.');
    } else {
        const directUrl = process.env.DIRECT_URL || '';
        const migrateEnv = { ...process.env };
        if (directUrl) {
            migrateEnv.DATABASE_URL = directUrl;
            console.log('ℹ️  Using DIRECT_URL for migration (bypasses pooler advisory lock issue)');
        }
        execSync('npx prisma migrate deploy', { stdio: 'inherit', env: migrateEnv });
    }

    console.log('\n--- 4. Building Next.js App ---');
    // Use npx to ensure we use the local next binary
    execSync('npx next build', { stdio: 'inherit' });

    console.log('\n✅ Build completed successfully!');
} catch (error) {
    console.error('\n❌ Build failed.');
    if (error.status) {
        console.error(`Exit code: ${error.status}`);
    }
    process.exit(1);
}
