import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';

let pool: Pool | null = null;
let poolInitialized = false;

function getConnectionString(): string {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
        throw new Error('DATABASE_URL is not defined');
    }
    return dbUrl;
}

function getConnectionType(connectionString: string): 'pooled' | 'direct' | 'local' {
    if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1')) {
        return 'local';
    }
    if (connectionString.includes('-pooler')) {
        return 'pooled';
    }
    return 'direct';
}

export function getPostgresPool(): Pool {
    if (pool) return pool;

    const connectionString = getConnectionString();
    const connType = getConnectionType(connectionString);

    if (!poolInitialized) {
        const maskedUrl = connectionString.replace(/:([^@]+)@/, ':***@');
        console.log(`[Postgres] Initializing connection: type=${connType}, url=${maskedUrl}`);
        poolInitialized = true;
    }

    const isLocal = connType === 'local';

    const poolConfig: any = {
        connectionString,
        max: 10,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
        allowExitOnIdle: true,
    };

    if (!isLocal) {
        poolConfig.ssl = {
            rejectUnauthorized: true,
        };
    }

    pool = new Pool(poolConfig);

    pool.on('error', (err, client) => {
        console.error('[Postgres] Unexpected error on idle client', err);
    });

    pool.on('connect', () => {
        console.log('[Postgres] Client connected to pool');
    });

    pool.on('acquire', () => {
        console.log('[Postgres] Client acquired from pool');
    });

    return pool;
}

export async function checkPostgresConnection(): Promise<{ healthy: boolean; error?: string }> {
    try {
        const p = getPostgresPool();
        const result = await p.query('SELECT 1 as health_check');
        if (result.rows[0]?.health_check === 1) {
            return { healthy: true };
        }
        return { healthy: false, error: 'Unexpected health check result' };
    } catch (error: any) {
        return { healthy: false, error: error.message || String(error) };
    }
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
        await client.query(`
            INSERT INTO users (id, created_at) 
            VALUES ($1, NOW()) 
            ON CONFLICT (id) DO NOTHING
        `, [userId]);

        await client.query("SELECT set_config('request.jwt.claim.sub', $1, true)", [userId]);

        return await callback(client);
    } finally {
        try {
            await client.query("SELECT set_config('request.jwt.claim.sub', NULL, false)");
        } catch {
        }
        client.release();
    }
}

export async function closePostgresPool() {
    if (pool) {
        await pool.end();
        pool = null;
    }
}
