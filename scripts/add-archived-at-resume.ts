
import { getPostgresPool, closePostgresPool } from '../src/lib/postgres';
import dotenv from 'dotenv';
dotenv.config();

async function migrate() {
    const pool = getPostgresPool();
    console.log('Adding archived_at to resumes...');

    try {
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Add archived_at column if it doesn't exist
            await client.query(`
                DO $$
                BEGIN
                    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='resumes' AND column_name='archived_at') THEN
                        ALTER TABLE resumes ADD COLUMN archived_at TIMESTAMPTZ;
                    END IF;
                END
                $$;
            `);
            await client.query('COMMIT');
            console.log('Migration successful.');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    } catch (e) {
        console.error('Migration failed:', e);
        process.exit(1);
    } finally {
        await closePostgresPool();
    }
}

migrate();
