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
  console.error('Usage: node scripts/reset-company-logos.mjs "Company A" "Company B"');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

try {
  const { rowCount } = await pool.query(
    `
      UPDATE companies
      SET domain = NULL,
          logo_url = NULL,
          logo_fetched = false,
          updated_at = NOW()
      WHERE name = ANY($1::text[])
    `,
    [names]
  );
  console.log(`Reset ${rowCount ?? 0} companies.`);
} finally {
  await pool.end();
}

