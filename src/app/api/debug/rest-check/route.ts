import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    const results: any = {
        supabase_rest: { status: 'pending' },
        env: {
            url: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'set' : 'missing',
            key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'set' : 'missing'
        }
    };

    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!url || !key) {
            throw new Error('Supabase URL/Key missing');
        }

        const supabase = createClient(url, key);

        const start = Date.now();
        // Simple query against a known table (app_settings or similar)
        // using count to minimize payload
        const { count, error } = await supabase
            .from('app_settings')
            .select('*', { count: 'exact', head: true });

        const duration = Date.now() - start;

        if (error) throw error;

        results.supabase_rest = {
            status: 'success',
            latency_ms: duration,
            message: 'Successfully connected via REST (HTTPS)',
            count
        };

    } catch (error: any) {
        results.supabase_rest = {
            status: 'error',
            error: error.message,
            details: JSON.stringify(error)
        };
    }

    return NextResponse.json(results, { status: 200 });
}
