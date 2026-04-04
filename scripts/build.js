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
    const migrateEnv = { ...process.env };
    if (process.env.DIRECT_URL) {
        migrateEnv.DATABASE_URL = process.env.DIRECT_URL;
        console.log('ℹ️  Using DIRECT_URL for migration (bypasses pooler advisory lock issue)');
    }
    execSync('npx prisma migrate deploy', { stdio: 'inherit', env: migrateEnv });

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
