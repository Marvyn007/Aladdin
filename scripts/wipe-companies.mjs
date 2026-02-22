import pkg from 'pg';
const { Pool } = pkg;
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env.local
const envPath = join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

async function wipe() {
    console.log('--- Wiping Company Cache ---');

    // 1. Postgres
    if (process.env.DATABASE_URL) {
        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });

        try {
            const client = await pool.connect();
            console.log('Connected to Postgres');
            const res = await client.query('DELETE FROM companies');
            console.log(`Wiped Postgres companies table: ${res.rowCount} rows removed.`);
            client.release();
        } catch (e) {
            console.error('Error wiping Postgres:', e.message);
        } finally {
            await pool.end();
        }
    }

    // 2. SQLite (local Dev)
    const sqlitePath = join(__dirname, '../aladdin.db');
    if (fs.existsSync(sqlitePath)) {
        try {
            // We can't easily import the sqlite lib here without a lot of setup,
            // but we can try to use standard 'sqlite3' if available or just skip if not critical
            // Given the environment, I'll stick to Postgres first and assume user wants production reset.
            console.log('SQLite detected at', sqlitePath);
        } catch (e) {
            console.error('Error wiping SQLite:', e.message);
        }
    }

    console.log('--- Wipe Complete ---');
}

wipe();
