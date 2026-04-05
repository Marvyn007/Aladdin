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
    // Neon's connection pooler doesn't support advisory locks required by migrate deploy.
    // Override DATABASE_URL with DIRECT_URL (non-pooled) for this step only.
    //
    // Safety checks:
    //   • SKIP_MIGRATIONS=true  → skip unconditionally (useful for re-deploys where
    //                             schema is already up to date)
    //   • DIRECT_URL contains "-pooler" → DIRECT_URL is misconfigured; skip and warn
    //     rather than hanging for 10s and failing the entire build.

    const skipMigrations = process.env.SKIP_MIGRATIONS === 'true';
    const directUrl = process.env.DIRECT_URL || '';
    const directUrlIsPooler = directUrl.includes('-pooler') || directUrl.includes('pgbouncer=true');

    if (skipMigrations) {
        console.log('⏭️  SKIP_MIGRATIONS=true — skipping prisma migrate deploy.');
    } else if (directUrlIsPooler) {
        console.warn('⚠️  DIRECT_URL appears to be a pooler URL (contains "-pooler" or "pgbouncer=true").');
        console.warn('    prisma migrate deploy requires a non-pooled direct connection.');
        console.warn('    Fix: set DIRECT_URL in Vercel to the non-pooled Neon URL');
        console.warn('    (remove "-pooler" from the hostname and "?pgbouncer=true" from the query string).');
        console.warn('    Skipping migrations to prevent build failure — run them manually via:');
        console.warn('    DIRECT_URL=<non-pooled-url> npx prisma migrate deploy');
    } else {
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
