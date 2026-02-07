
const { getPostgresPool } = require('./src/lib/postgres');
require('dotenv').config();

async function backfill() {
    console.log('Starting search field backfill...');
    const pool = getPostgresPool();
    try {
        const result = await pool.query(`
            UPDATE jobs 
            SET title = title 
            WHERE title_normalized IS NULL
        `);
        console.log(`Successfully backfilled ${result.rowCount} jobs.`);
    } catch (err) {
        console.error('Backfill failed:', err);
    } finally {
        await pool.end();
    }
}

backfill();
