
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
        console.log('Connected to DB. Running migrations...');

        // Add columns safely
        await client.query(`
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_resolved BOOLEAN DEFAULT false;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_confidence DOUBLE PRECISION;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS geo_source TEXT;
      ALTER TABLE jobs ADD COLUMN IF NOT EXISTS location_raw TEXT;
      
      -- Index for bounding box queries
      CREATE INDEX IF NOT EXISTS idx_jobs_geo ON jobs (latitude, longitude) WHERE geo_resolved = true;
    `);

        console.log('Migration successful.');
        client.release();
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

runMigration();
