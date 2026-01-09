import { NextResponse } from 'next/server';
import { getDbType } from '@/lib/db';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const result: any = {
        dbType: getDbType(),
        supabaseConfigured: isSupabaseConfigured(),
    };

    try {
        const client = getSupabaseClient();
        const { data, error, status, statusText } = await client
            .from('resumes')
            .select('id, filename')
            .limit(5);

        if (error) {
            result.supabaseError = {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                status,
                statusText
            };
        } else {
            result.supabaseSuccess = {
                count: data?.length || 0,
                sample: data
            };
        }
    } catch (e: any) {
        result.exception = e.message;
    }

    return NextResponse.json(result);
}
