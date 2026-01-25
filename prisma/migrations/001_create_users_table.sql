-- Migration 001: Create Users Table
-- This creates the users table to store Clerk user references

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                    -- Clerk userId (e.g., "user_2abc123...")
    email TEXT,
    name TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Create index on email for lookups
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Insert legacy user for existing data migration
-- This user will own all pre-existing records
INSERT INTO users (id, email, name, created_at)
VALUES (
    'legacy_user_001',
    'legacy@aladdin.local',
    'Legacy User (Pre-Auth Data)',
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
