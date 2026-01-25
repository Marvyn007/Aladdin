-- Prisma Migration SQL for Neon Postgres
-- Generated from prisma/schema.prisma
-- Database: ep-aged-queen-aewp9acl-pooler.c-2.us-east-2.aws.neon.tech/neondb

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "source_url" TEXT NOT NULL,
    "posted_at" TIMESTAMPTZ,
    "fetched_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT DEFAULT 'fresh',
    "archived_at" TIMESTAMPTZ,
    "match_score" INTEGER DEFAULT 0,
    "matched_skills" JSONB,
    "missing_skills" JSONB,
    "why" TEXT,
    "normalized_text" TEXT,
    "raw_text_summary" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "is_imported" INTEGER DEFAULT 0,
    "original_posted_date" TEXT,
    "original_posted_raw" TEXT,
    "original_posted_source" TEXT,
    "location_display" TEXT,
    "import_tag" TEXT,
    "raw_description_html" TEXT,
    "job_description_plain" TEXT,
    "date_posted_iso" TEXT,
    "date_posted_display" TEXT,
    "date_posted_relative" INTEGER DEFAULT 0,
    "source_host" TEXT,
    "scraped_at" TIMESTAMPTZ,
    "extraction_confidence" JSONB,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "upload_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "parsed_json" JSONB,
    "is_default" BOOLEAN DEFAULT false,
    "file_data" BYTEA,
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_profiles" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "upload_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "parsed_json" JSONB,
    "file_data" BYTEA,
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "linkedin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_letters" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "resume_id" UUID,
    "generated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "content_html" TEXT,
    "content_text" TEXT,
    "pdf_blob_url" TEXT,
    "status" TEXT DEFAULT 'generated',
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cover_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "column_name" TEXT DEFAULT 'Applied',
    "applied_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "resume_id" UUID,
    "cover_letter_id" UUID,
    "external_link" TEXT,
    "deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "fresh_limit" INTEGER DEFAULT 300,
    "last_updated" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    "excluded_keywords" JSONB,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jobs_content_hash_key" ON "jobs"("content_hash");

-- CreateIndex
CREATE INDEX "idx_jobs_fetched_at" ON "jobs"("fetched_at" DESC);

-- CreateIndex
CREATE INDEX "idx_jobs_status" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "idx_jobs_match_score" ON "jobs"("match_score" DESC);

-- CreateIndex
CREATE INDEX "idx_jobs_status_score" ON "jobs"("status", "match_score" DESC);

-- CreateIndex
CREATE INDEX "idx_jobs_content_hash" ON "jobs"("content_hash");

-- CreateIndex
CREATE INDEX "idx_jobs_import_tag" ON "jobs"("import_tag");

-- CreateIndex
CREATE INDEX "idx_resumes_default" ON "resumes"("is_default");

-- CreateIndex
CREATE INDEX "idx_applications_job_id" ON "applications"("job_id");

-- CreateIndex
CREATE INDEX "idx_applications_column" ON "applications"("column_name");

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "cover_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
