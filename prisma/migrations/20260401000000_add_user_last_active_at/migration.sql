-- AlterTable (idempotent: column may already exist from a prior manual migration)
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMPTZ(6);
