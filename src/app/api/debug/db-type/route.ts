import { NextResponse } from 'next/server';
import { getDbType } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
    return NextResponse.json({
        selectedDbType: getDbType(),
        env: {
            USE_SUPABASE_REST: process.env.USE_SUPABASE_REST,
            DATABASE_URL: process.env.DATABASE_URL ? 'SET' : 'NOT_SET',
            SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'SET' : 'NOT_SET',
        }
    });
}
