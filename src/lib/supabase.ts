// Supabase client for job-hunt-vibe - Simplified version

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Singleton pattern for Supabase client
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
    if (supabaseClient) {
        return supabaseClient;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        throw new Error('Missing Supabase environment variables: SUPABASE_URL and SUPABASE_KEY must be set');
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
    return !!(process.env.SUPABASE_URL && process.env.SUPABASE_KEY);
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
