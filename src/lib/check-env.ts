export function checkRequiredEnv() {
    // Skip checking in build phase (Next.js executes code during build)
    if (process.env.NEXT_PHASE === 'phase-production-build') return;

    // Only enforce database strictness in production node environment
    if (process.env.NODE_ENV === 'production') {
        const hasDb = process.env.DATABASE_URL || (process.env.SUPABASE_URL && process.env.SUPABASE_KEY);

        if (!hasDb) {
            console.error('\n❌ FATAL: No production database configured.');
            console.error('   Please set DATABASE_URL (for Postgres) or SUPABASE_URL + SUPABASE_KEY\n');
            process.exit(1);
        }

        const hasS3 = process.env.AWS_ACCESS_KEY_ID &&
            process.env.AWS_SECRET_ACCESS_KEY &&
            process.env.AWS_REGION &&
            process.env.AWS_S3_BUCKET;

        if (!hasS3) {
            console.error('\n❌ FATAL: Missing AWS S3 configuration in production.');
            console.error('   Please set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, AWS_S3_BUCKET\n');
            process.exit(1);
        }

        // Specifically block SQLite if usage is attempted in Prod via env (though getDbType will also handle this)
        if (process.env.USE_SQLITE === 'true') {
            console.warn('\n⚠️ WARNING: USE_SQLITE=true is set in production. This is highly discouraged and ephemeral.');
        }
    }
}
