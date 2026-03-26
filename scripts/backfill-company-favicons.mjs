import pkg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { ensureCompanyProfile } from '../src/lib/company';
import { hydrateCompanyLogos } from '../src/lib/company-backfill';

const { Pool } = pkg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const envPath = join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

function parseLimitArg() {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--limit=')) {
      const value = Number(arg.split('=')[1]);
      if (!Number.isNaN(value) && value > 0) {
        return Math.floor(value);
      }
    }
    if (arg === '--limit') {
      const next = args[i + 1];
      if (next) {
        const value = Number(next);
        if (!Number.isNaN(value) && value > 0) {
          return Math.floor(value);
        }
      }
    }
  }
  return null;
}

export async function runBackfill() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is missing in environment');
    process.exit(1);
  }

  const limit = parseLimitArg();
  if (limit) {
    console.log(`Dry run limit enabled: processing first ${limit} companies`);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const client = await pool.connect();

  try {
    let query = `
      SELECT
        c.id,
        c.name,
        c.domain,
        c.website_url,
        c.logo_url
      FROM companies c
      WHERE (c.logo_url IS NULL OR c.logo_url = '')
      ORDER BY c.name ASC
    `;
    const params = [];
    if (limit) {
      query += ' LIMIT $1';
      params.push(limit);
    }

    const { rows } = params.length > 0 ? await client.query(query, params) : await client.query(query);
    console.log(`Found ${rows.length} companies missing logos${limit ? ` (limit ${limit})` : ''}.`);
    await hydrateCompanyLogos(rows, ensureCompanyProfile, {
      logger: console,
      throttleMs: 180,
    });
  } finally {
    client.release();
    await pool.end();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBackfill().catch((err) => {
    console.error('Fatal backfill error:', err);
    process.exit(1);
  });
}
