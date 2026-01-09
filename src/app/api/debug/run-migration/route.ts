import { NextResponse } from 'next/server';
import { getSupabaseClient } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
    const results: any = { migrations: [] };

    try {
        const client = getSupabaseClient();

        // Add s3_key column to resumes table if missing
        const { error: resume_error } = await client.rpc('exec_sql', {
            query: `ALTER TABLE resumes ADD COLUMN IF NOT EXISTS s3_key TEXT;`
        });

        if (resume_error) {
            // Try direct approach if rpc doesn't exist
            results.migrations.push({
                table: 'resumes',
                column: 's3_key',
                status: 'rpc_failed',
                error: resume_error.message,
                manual_sql: 'ALTER TABLE resumes ADD COLUMN IF NOT EXISTS s3_key TEXT;'
            });
        } else {
            results.migrations.push({ table: 'resumes', column: 's3_key', status: 'success' });
        }

        // Add s3_key to cover_letters
        const { error: cl_error } = await client.rpc('exec_sql', {
            query: `ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS s3_key TEXT;`
        });

        if (cl_error) {
            results.migrations.push({
                table: 'cover_letters',
                column: 's3_key',
                status: 'rpc_failed',
                error: cl_error.message,
                manual_sql: 'ALTER TABLE cover_letters ADD COLUMN IF NOT EXISTS s3_key TEXT;'
            });
        } else {
            results.migrations.push({ table: 'cover_letters', column: 's3_key', status: 'success' });
        }

        // Add s3_key to linkedin_profiles
        const { error: lp_error } = await client.rpc('exec_sql', {
            query: `ALTER TABLE linkedin_profiles ADD COLUMN IF NOT EXISTS s3_key TEXT;`
        });

        if (lp_error) {
            results.migrations.push({
                table: 'linkedin_profiles',
                column: 's3_key',
                status: 'rpc_failed',
                error: lp_error.message,
                manual_sql: 'ALTER TABLE linkedin_profiles ADD COLUMN IF NOT EXISTS s3_key TEXT;'
            });
        } else {
            results.migrations.push({ table: 'linkedin_profiles', column: 's3_key', status: 'success' });
        }

    } catch (e: any) {
        results.exception = e.message;
    }

    return NextResponse.json(results);
}
