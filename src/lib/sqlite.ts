// SQLite fallback for local development
// Uses better-sqlite3 for synchronous operations

import type { Database as DatabaseType } from 'better-sqlite3';

let db: DatabaseType | null = null;
const DB_NAME = 'job-hunt-vibe.sqlite';

export function getSQLiteDB(): DatabaseType {
  if (db) return db;

  // Dynamic import to prevent Vercel build errors (fs/better-sqlite3)
  const Database = require('better-sqlite3');
  const path = require('path');
  const fs = require('fs');

  const DB_PATH = path.join(process.cwd(), 'data', DB_NAME);

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);

  // Enable WAL mode for better concurrency
  db!.pragma('journal_mode = WAL');

  // Initialize schema
  initializeSchema(db!);

  return db!;
}

function initializeSchema(database: DatabaseType): void {
  database.exec(`
    -- Jobs table
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      title TEXT NOT NULL,
      company TEXT,
      location TEXT,
      source_url TEXT NOT NULL,
      posted_at TEXT,
      fetched_at TEXT DEFAULT (datetime('now')),
      status TEXT CHECK (status IN ('fresh', 'archived')) DEFAULT 'fresh',
      archived_at TEXT,
      match_score INTEGER DEFAULT 0,
      matched_skills TEXT, -- JSON array stored as text
      missing_skills TEXT, -- JSON array stored as text
      why TEXT,
      normalized_text TEXT,
      raw_text_summary TEXT,
      content_hash TEXT UNIQUE,
      content_hash TEXT UNIQUE,
      is_imported INTEGER DEFAULT 0,
      original_posted_date TEXT,
      original_posted_raw TEXT,
      original_posted_source TEXT,
      location_display TEXT,
      import_tag TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Add archived_at column if it doesn't exist (for existing databases)
    -- SQLite doesn't support IF NOT EXISTS for ALTER TABLE, so we handle this in code

    -- Resumes table
    CREATE TABLE IF NOT EXISTS resumes (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      filename TEXT NOT NULL,
      upload_at TEXT DEFAULT (datetime('now')),
      parsed_json TEXT, -- JSON stored as text
      is_default INTEGER DEFAULT 0,
      file_data BLOB,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- LinkedIn profiles table
    CREATE TABLE IF NOT EXISTS linkedin_profiles (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      filename TEXT NOT NULL,
      upload_at TEXT DEFAULT (datetime('now')),
      parsed_json TEXT, -- JSON stored as text
      file_data BLOB,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Cover letters table
    CREATE TABLE IF NOT EXISTS cover_letters (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
      resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
      generated_at TEXT DEFAULT (datetime('now')),
      content_html TEXT,
      content_text TEXT,
      pdf_blob_url TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Applications table (Kanban tracker)
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
      job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
      column_name TEXT CHECK (column_name IN ('Applied', 'Got OA', 'Interview R1', 'Interview R2', 'Interview R3', 'Interview R4', 'Got Offer')) DEFAULT 'Applied',
      applied_at TEXT DEFAULT (datetime('now')),
      notes TEXT,
      resume_id TEXT REFERENCES resumes(id) ON DELETE SET NULL,
      cover_letter_id TEXT REFERENCES cover_letters(id) ON DELETE SET NULL,
      external_link TEXT,
      deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- App settings table
    CREATE TABLE IF NOT EXISTS app_settings (
      id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      fresh_limit INTEGER DEFAULT 300,
      last_updated TEXT,
      excluded_keywords TEXT, -- JSON array
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- AI Provider Stats table (for safety limits)
    CREATE TABLE IF NOT EXISTS ai_provider_stats (
      provider_name TEXT PRIMARY KEY,
      status TEXT DEFAULT 'healthy', -- healthy, rate_limited, disabled_free_tier_exhausted, disabled_billing
      calls_today INTEGER DEFAULT 0,
      last_reset TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Insert default settings if not exists
    INSERT OR IGNORE INTO app_settings (id, fresh_limit) VALUES (1, 300);

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_jobs_fetched_at ON jobs(fetched_at DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
    CREATE INDEX IF NOT EXISTS idx_jobs_match_score ON jobs(match_score DESC);
    CREATE INDEX IF NOT EXISTS idx_jobs_content_hash ON jobs(content_hash);
    CREATE INDEX IF NOT EXISTS idx_applications_job_id ON applications(job_id);
    CREATE INDEX IF NOT EXISTS idx_applications_column ON applications(column_name);
    CREATE INDEX IF NOT EXISTS idx_resumes_default ON resumes(is_default);
  `);

  // Run migrations for existing databases
  runMigrations(database);
}

// Run schema migrations for existing databases
function runMigrations(database: DatabaseType): void {
  // Check if archived_at column exists in jobs table
  const tableInfo = database.prepare("PRAGMA table_info(jobs)").all() as { name: string }[];
  const hasArchivedAt = tableInfo.some(col => col.name === 'archived_at');

  if (!hasArchivedAt) {
    console.log('Migration: Adding archived_at column to jobs table...');
    database.exec("ALTER TABLE jobs ADD COLUMN archived_at TEXT");
    console.log('Migration: archived_at column added successfully.');
  }

  // Check if status column exists in cover_letters table
  const clTableInfo = database.prepare("PRAGMA table_info(cover_letters)").all() as { name: string }[];
  const hasStatus = clTableInfo.some(col => col.name === 'status');

  if (!hasStatus) {
    console.log('Migration: Adding status column to cover_letters table...');
    database.exec("ALTER TABLE cover_letters ADD COLUMN status TEXT CHECK (status IN ('pending', 'generated', 'failed')) DEFAULT 'generated'");
    console.log('Migration: status column added successfully.');
  }

  // Check if is_imported column exists in jobs table
  if (!tableInfo.some(col => col.name === 'is_imported')) {
    console.log('Migration: Adding is_imported column to jobs table...');
    database.exec("ALTER TABLE jobs ADD COLUMN is_imported INTEGER DEFAULT 0");
    console.log('Migration: is_imported column added successfully.');
  }

  // Check for new import fields
  if (!tableInfo.some(col => col.name === 'original_posted_date')) {
    console.log('Migration: Adding advanced import fields to jobs table...');
    database.exec("ALTER TABLE jobs ADD COLUMN original_posted_date TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN original_posted_raw TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN original_posted_source TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN location_display TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN import_tag TEXT");
    console.log('Migration: advanced import fields added successfully.');
  }

  // Migration: Add new scraper v2 fields
  if (!tableInfo.some(col => col.name === 'raw_description_html')) {
    console.log('Migration: Adding scraper v2 fields to jobs table...');
    database.exec("ALTER TABLE jobs ADD COLUMN raw_description_html TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN job_description_plain TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN date_posted_iso TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN date_posted_display TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN date_posted_relative INTEGER DEFAULT 0");
    database.exec("ALTER TABLE jobs ADD COLUMN source_host TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN scraped_at TEXT");
    database.exec("ALTER TABLE jobs ADD COLUMN extraction_confidence TEXT"); // JSON string
    console.log('Migration: scraper v2 fields added successfully.');
  }
  // Migration: Add excluded_keywords to app_settings
  const settingsInfo = database.prepare("PRAGMA table_info(app_settings)").all() as { name: string }[];
  if (!settingsInfo.some(col => col.name === 'excluded_keywords')) {
    console.log('Migration: Adding excluded_keywords to app_settings...');
    database.exec("ALTER TABLE app_settings ADD COLUMN excluded_keywords TEXT");
    console.log('Migration: excluded_keywords added successfully.');
  }
}

// Helper functions for SQLite operations
export function closeSQLiteDB(): void {
  if (db) {
    db.close();
    db = null;
  }
}

export function isSQLiteConfigured(): boolean {
  return process.env.USE_SQLITE === 'true';
}

// Archive old jobs (SQLite version)
export function archiveOldJobs(): number {
  const database = getSQLiteDB();
  const stmt = database.prepare(`
    UPDATE jobs
    SET status = 'archived', updated_at = datetime('now')
    WHERE status = 'fresh'
    AND datetime(fetched_at) < datetime('now', '-24 hours')
  `);
  const result = stmt.run();
  return result.changes;
}

// Purge old archives (SQLite version)
export function purgeOldArchives(): number {
  const database = getSQLiteDB();

  // Delete related records first
  database.prepare(`
    DELETE FROM applications
    WHERE job_id IN (
      SELECT id FROM jobs
      WHERE status = 'archived'
      AND datetime(fetched_at) < datetime('now', '-7 days')
    )
  `).run();

  database.prepare(`
    DELETE FROM cover_letters
    WHERE job_id IN (
      SELECT id FROM jobs
      WHERE status = 'archived'
      AND datetime(fetched_at) < datetime('now', '-7 days')
    )
  `).run();

  const stmt = database.prepare(`
    DELETE FROM jobs
    WHERE status = 'archived'
    AND datetime(fetched_at) < datetime('now', '-7 days')
  `);
  const result = stmt.run();
  return result.changes;
}
