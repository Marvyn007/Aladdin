
require('dotenv').config();
const { Pool } = require('pg');

async function runMigration() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        console.error('DATABASE_URL is missing');
        return;
    }

    const pool = new Pool({
        connectionString,
        ssl: connectionString.includes('localhost') ? false : { rejectUnauthorized: false }
    });

    try {
        const client = await pool.connect();
        console.log('Connected to DB. Checking/Adding columns...');

        // Add columns if they don't exist
        await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_resolved BOOLEAN DEFAULT FALSE;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_confidence DOUBLE PRECISION;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_source TEXT; 
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_raw TEXT;
      
      -- Ensure indexes
      CREATE INDEX IF NOT EXISTS idx_jobs_geo_resolved ON jobs(geo_resolved);
    `);

        console.log('Columns verified/added.');
        client.release();
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

runMigration();
