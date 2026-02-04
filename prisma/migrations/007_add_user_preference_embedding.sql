-- Add preference_embedding column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS preference_embedding vector(384);
