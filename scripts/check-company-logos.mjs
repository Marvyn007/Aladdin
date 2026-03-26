import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'node:fs';
import { join } from 'node:path';

const { Pool } = pkg;

const envPath = join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

const names = process.argv.slice(2);
if (!names.length) {
  console.error('Usage: node scripts/check-company-logos.mjs "Company A" "Company B"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const { rows } = await pool.query(
    `
      SELECT name, domain, logo_url, logo_fetched
      FROM companies
      WHERE name = ANY($1::text[])
      ORDER BY name ASC
    `,
    [names]
  );
  console.table(rows);
} finally {
  await pool.end();
}

