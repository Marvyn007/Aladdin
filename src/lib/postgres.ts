import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;

export function getPostgresPool(): Pool {
    if (pool) return pool;

    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
    }

    // Parse the connection string to check for SSL needs or just force it for cloud DBs
    const isLocal = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');

    pool = new Pool({
        connectionString,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 20000,
        // Force SSL for non-local connections (Supabase/Neon/etc usually require this)
        // rejectUnauthorized: false allows self-signed certs which is common in some hosted envs or proxies
        ssl: isLocal ? false : { rejectUnauthorized: false }
    });

    pool.on('error', (err, client) => {
        console.error('Unexpected error on idle client', err);
        // process.exit(-1); // Don't exit process, just let pool handle it or reconnect
    });

    return pool;
}

export function isPostgresConfigured(): boolean {
    return !!process.env.DATABASE_URL;
}

/**
 * Execute a query with retry logic for transient failures
 */
export async function query<T extends QueryResultRow = any>(text: string, params: any[] = [], retries = 3): Promise<QueryResult<T>> {
    const p = getPostgresPool();

    let lastError: any;

    for (let i = 0; i < retries; i++) {
        try {
            return await p.query(text, params);
        } catch (error: any) {
            lastError = error;
            // Check for transient errors (connection related)
            if (isTransientError(error)) {
                const delay = Math.pow(2, i) * 100; // Exponential backoff
                await new Promise(res => setTimeout(res, delay));
                continue;
            }
            throw error;
        }
    }
    throw lastError;
}

function isTransientError(error: any): boolean {
    // Check error codes for connection issues
    // 57P01: admin_shutdown
    // 57P02: crash_shutdown
    // 57P03: cannot_connect_now
    // 08*: connection exceptions
    const code = error.code;
    return code && (code.startsWith('08') || code === '57P01' || code === '57P02' || code === '57P03');
}


export async function executeWithUser<T>(userId: string, callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
        // Set the user ID for RLS policies (Supabase/Postgres compatible)
        // 1. Ensure user exists (Fix FK constraint)
        // Note: Some DB schemas have both id and user_id columns, so we set both
        await client.query(`
            INSERT INTO users (id, created_at) 
            VALUES ($1, NOW()) 
            ON CONFLICT (id) DO NOTHING
        `, [userId]);

        // 2. Set the user ID for RLS policies
        // is_local=true means it applies ONLY to the current transaction (safer for pooling)
        await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);

        // Execute the actual query callback
        return await callback(client);
    } finally {
        // Clean up session variables to be safe
        // Setting to NULL effectively clears it
        await client.query("SELECT set_config('request.jwt.claim.sub', NULL, false)");
        client.release();
    }
}

export async function closePostgresPool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
