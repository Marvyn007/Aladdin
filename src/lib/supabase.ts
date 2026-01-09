// Supabase client for job-hunt-vibe - Simplified version

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton pattern for Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) {
        return supabaseClient;
    }

    // Support both naming conventions
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL/KEY) must be set');
    }

    supabaseClient = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false, // Single-user app, no auth needed
        },
    });

    return supabaseClient;
}

// Check if Supabase is configured
export function isSupabaseConfigured(): boolean {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    return !!(url && key);
}

// Helper to check connection
export async function checkSupabaseConnection(): Promise<boolean> {
    try {
        const client = getSupabaseClient();
        const { error } = await client.from('app_settings').select('id').limit(1);
        return !error;
    } catch {
        return false;
    }
}
