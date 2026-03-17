
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

async function addConstraint() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database.');

        console.log('Adding unique constraint to tailored_resumes...');
        await client.query(`
            ALTER TABLE tailored_resumes
            ADD CONSTRAINT uniq_tailored_resume_user_job UNIQUE (user_id, job_id);
        `);
        console.log('Unique constraint added successfully.');

    } catch (err) {
        console.error('Error adding constraint:', err);
    } finally {
        await client.end();
    }
}

addConstraint();
