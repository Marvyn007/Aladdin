-- AlterTable: add admin_curation_status to jobs
ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "admin_curation_status" TEXT DEFAULT 'not_reviewed';
