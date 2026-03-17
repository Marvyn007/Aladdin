
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function checkSchema() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        const res = await client.query(`
            SELECT
                indexname,
                indexdef
            FROM
                pg_indexes
            WHERE
                tablename = 'tailored_resumes';
        `);

        console.log('Indexes on tailored_resumes:');
        console.log(JSON.stringify(res.rows, null, 2));

        const tableRes = await client.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_name = 'tailored_resumes';
        `);
        console.log('Columns on tailored_resumes:');
        console.log(JSON.stringify(tableRes.rows, null, 2));

    } catch (err) {
        console.error('Error checking schema:', err);
    } finally {
        await client.end();
    }
}

checkSchema();
