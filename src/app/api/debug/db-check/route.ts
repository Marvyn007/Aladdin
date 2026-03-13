import { NextResponse } from 'next/server';
import { getPostgresPool, checkPostgresConnection } from '@/lib/postgres';
import { getS3Client } from '@/lib/s3';
import { ListBucketsCommand } from '@aws-sdk/client-s3';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPooled = dbUrl.includes('-pooler');
    const isLocal = dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1');

    const results: any = {
        database: { status: 'pending' },
        s3: { status: 'pending' },
        env: {
            has_db_url: !!dbUrl,
            connection_type: isLocal ? 'local' : isPooled ? 'pooled' : 'direct',
            has_supabase: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
            use_sqlite: process.env.USE_SQLITE,
            aws_region: process.env.AWS_REGION,
            node_env: process.env.NODE_ENV,
        }
    };

    // 1. Test Database
    try {
        const healthCheck = await checkPostgresConnection();
        if (healthCheck.healthy) {
            const pool = getPostgresPool();
            const start = Date.now();
            const res = await pool.query('SELECT NOW() as now, version() as pg_version');
            const duration = Date.now() - start;

            results.database = {
                status: 'success',
                latency_ms: duration,
                timestamp: res.rows[0].now,
                pg_version: res.rows[0].pg_version,
            };
        } else {
            results.database = {
                status: 'error',
                error: healthCheck.error || 'Connection failed',
                hint: isPooled 
                    ? 'Pooled connection failed - check Neon project status and network connectivity'
                    : 'Connection failed - consider using pooled connection (DATABASE_URL with -pooler)'
            };
        }
    } catch (error: any) {
        results.database = {
            status: 'error',
            error: error.message,
            code: error.code,
            hint: error.message.includes('timeout') && isPooled 
                ? 'Pooled connection timeout - check network/firewall for port 5432'
                : error.message.includes('timeout')
                    ? 'Connection timeout - consider using pooled connection'
                    : undefined,
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
