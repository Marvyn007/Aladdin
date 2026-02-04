
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
        console.log('Connected to DB. Creating job_geo_points table...');

        // 1. Create Table
        await client.query(`
      CREATE TABLE IF NOT EXISTS job_geo_points (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        job_id UUID REFERENCES jobs(id) ON DELETE CASCADE,
        location_label TEXT,
        latitude DOUBLE PRECISION NOT NULL,
        longitude DOUBLE PRECISION NOT NULL,
        confidence DOUBLE PRECISION,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_job_geo_points_coords ON job_geo_points(latitude, longitude);
      CREATE INDEX IF NOT EXISTS idx_job_geo_points_job_id ON job_geo_points(job_id);
    `);

        // 2. Backfill existing resolved jobs
        // Only backfill if we have lat/lng and NO points exist for that job
        console.log('Backfilling existing resolved jobs...');
        const result = await client.query(`
        INSERT INTO job_geo_points (job_id, location_label, latitude, longitude, confidence)
        SELECT id, location, latitude, longitude, geo_confidence
        FROM jobs
        WHERE geo_resolved = true 
          AND latitude IS NOT NULL 
          And longitude IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM job_geo_points WHERE job_id = jobs.id)
    `);

        console.log(`Backfilled ${result.rowCount} existing coordinates.`);
        console.log('Migration successful.');
        client.release();
    } catch (e) {
        console.error('Migration failed:', e);
    } finally {
        await pool.end();
    }
}

runMigration();
