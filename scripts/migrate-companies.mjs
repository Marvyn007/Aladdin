import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function migrate() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        console.log('Connected to database');

        // Fetch unique companies from jobs
        const res = await client.query(`
      SELECT company as name
      FROM jobs
      WHERE company IS NOT NULL AND company != ''
      GROUP BY company
    `);

        const companies = res.rows;
        console.log(`Found ${companies.length} unique companies in jobs table`);

        let i = 0;
        for (const c of companies) {
            if (!c.name) continue;

            const domain = c.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com';
            try {
                await client.query(`
          INSERT INTO companies (id, name, domain, created_at, updated_at)
          VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
          ON CONFLICT (name) DO NOTHING
        `, [c.name, domain]);
                i++;
            } catch (e) {
                console.error('Error inserting', c.name, e.message);
            }
        }

        console.log(`Successfully migrated ${i} companies`);

        // Add search trigram index for companies name if not exists
        await client.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_companies_name_trgm ON companies USING gin (name gin_trgm_ops)`);

    } catch (err) {
        console.error('Migration error:', err);
    } finally {
        await client.end();
    }
}

migrate();
