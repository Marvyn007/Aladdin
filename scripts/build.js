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
    // Resolve any previously-failed migrations before deploying.
    // This is needed when a migration failed in a prior deploy (e.g. "column already exists")
    // and Prisma blocked subsequent deploys with P3009. Safe to run even if no failures exist.
    try {
        execSync(
            'npx prisma migrate resolve --applied 20260401000000_add_user_last_active_at',
            { stdio: 'inherit' }
        );
        console.log('✅ Resolved failed migration state');
    } catch (_) {
        // Migration was not in a failed state — nothing to resolve, continue.
    }
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });

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
