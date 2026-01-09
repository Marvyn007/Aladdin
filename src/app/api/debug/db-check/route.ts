import { NextResponse } from 'next/server';
import { getPostgresPool } from '@/lib/postgres';
import { getS3Client } from '@/lib/s3';
import { ListBucketsCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const results: any = {
        database: { status: 'pending' },
        s3: { status: 'pending' },
        env: {
            has_db_url: !!process.env.DATABASE_URL,
            has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            use_sqlite: process.env.USE_SQLITE,
            aws_region: process.env.AWS_REGION,
            node_env: process.env.NODE_ENV,
        }
    };

    // 1. Test Database
    try {
        const pool = getPostgresPool();
        const start = Date.now();
        // Simple query, strict timeout for test
        const res = await pool.query('SELECT NOW() as now');
        const duration = Date.now() - start;

        results.database = {
            status: 'success',
            latency_ms: duration,
            timestamp: res.rows[0].now,
            connection_settings: {
                ssl: (pool as any).options?.ssl ? 'enabled' : 'disabled',
                host: (pool as any).options?.host,
                port: (pool as any).options?.port,
            }
        };
    } catch (error: any) {
        results.database = {
            status: 'error',
            error: error.message,
            code: error.code,
            details: JSON.stringify(error, Object.getOwnPropertyNames(error))
        };
    }

    // 2. Test S3
    try {
        const s3 = getS3Client();
        if (s3) {
            const start = Date.now();
            await s3.send(new ListBucketsCommand({}));
            const duration = Date.now() - start;
            results.s3 = {
                status: 'success',
                latency_ms: duration,
                message: 'Successfully listed buckets'
            };
        } else {
            results.s3 = { status: 'skipped', message: 'S3 client not initialized' };
        }
    } catch (error: any) {
        results.s3 = {
            status: 'error',
            error: error.message,
            code: error.code
        };
    }

    return NextResponse.json(results, { status: 200 });
}
