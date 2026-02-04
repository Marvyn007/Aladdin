CREATE EXTENSION IF NOT EXISTS vector;

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "source_url" TEXT NOT NULL,
    "posted_at" TIMESTAMPTZ(6),
    "fetched_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT DEFAULT 'fresh',
    "archived_at" TIMESTAMPTZ(6),
    "normalized_text" TEXT,
    "raw_text_summary" TEXT,
    "content_hash" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
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
    "scraped_at" TIMESTAMPTZ(6),
    "extraction_confidence" JSONB,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "geo_resolved" BOOLEAN NOT NULL DEFAULT false,
    "geo_confidence" DOUBLE PRECISION,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_jobs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "status" TEXT DEFAULT 'fresh',
    "match_score" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "matched_skills" JSONB,
    "missing_skills" JSONB,
    "why" TEXT,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "user_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resumes" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "upload_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "parsed_json" JSONB,
    "is_default" BOOLEAN DEFAULT false,
    "file_data" BYTEA,
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "linkedin_profiles" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "upload_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "parsed_json" JSONB,
    "file_data" BYTEA,
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "linkedin_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cover_letters" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "resume_id" UUID,
    "generated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "content_html" TEXT,
    "content_text" TEXT,
    "pdf_blob_url" TEXT,
    "status" TEXT DEFAULT 'generated',
    "s3_key" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "cover_letters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applications" (
    "id" UUID NOT NULL,
    "job_id" UUID,
    "column_name" TEXT DEFAULT 'Applied',
    "applied_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "resume_id" UUID,
    "cover_letter_id" UUID,
    "external_link" TEXT,
    "deleted" BOOLEAN DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "id" SERIAL NOT NULL,
    "fresh_limit" INTEGER DEFAULT 300,
    "last_updated" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "excluded_keywords" JSONB,
    "user_id" TEXT NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "playing_with_neon" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "value" REAL,

    CONSTRAINT "playing_with_neon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_embeddings" (
    "job_id" UUID NOT NULL,
    "embedding" vector(384),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_embeddings_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "resume_embeddings" (
    "resume_id" UUID NOT NULL,
    "embedding" vector(384),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resume_embeddings_pkey" PRIMARY KEY ("resume_id")
);

-- CreateTable
CREATE TABLE "user_interactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "interaction_type" TEXT NOT NULL,
    "metadata" JSONB DEFAULT '{}',
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_history" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "query_text" TEXT NOT NULL,
    "embedding" vector(384),
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_content_hash_key" ON "jobs"("content_hash");

-- CreateIndex
CREATE INDEX "idx_jobs_fetched_at" ON "jobs"("fetched_at" DESC);

-- CreateIndex
CREATE INDEX "idx_jobs_content_hash" ON "jobs"("content_hash");

-- CreateIndex
CREATE INDEX "idx_jobs_import_tag" ON "jobs"("import_tag");

-- CreateIndex
CREATE INDEX "idx_jobs_status" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_user_job" ON "user_jobs"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_resumes_user_id" ON "resumes"("user_id");

-- CreateIndex
CREATE INDEX "idx_resumes_user_default" ON "resumes"("user_id", "is_default");

-- CreateIndex
CREATE INDEX "idx_linkedin_user_id" ON "linkedin_profiles"("user_id");

-- CreateIndex
CREATE INDEX "idx_cover_letters_user_id" ON "cover_letters"("user_id");

-- CreateIndex
CREATE INDEX "idx_applications_user_id" ON "applications"("user_id");

-- CreateIndex
CREATE INDEX "idx_applications_user_job" ON "applications"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_applications_column" ON "applications"("column_name");

-- CreateIndex
CREATE UNIQUE INDEX "app_settings_user_id_key" ON "app_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_app_settings_user_id" ON "app_settings"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_interactions_user_job" ON "user_interactions"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_user_interactions_created_at" ON "user_interactions"("created_at");

-- CreateIndex
CREATE INDEX "idx_search_history_user_created" ON "search_history"("user_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "user_jobs" ADD CONSTRAINT "fk_user_jobs_job" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "user_jobs" ADD CONSTRAINT "fk_user_jobs_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "resumes" ADD CONSTRAINT "fk_resumes_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "linkedin_profiles" ADD CONSTRAINT "fk_linkedin_profiles_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "cover_letters_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cover_letters" ADD CONSTRAINT "fk_cover_letters_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_cover_letter_id_fkey" FOREIGN KEY ("cover_letter_id") REFERENCES "cover_letters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "applications_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applications" ADD CONSTRAINT "fk_applications_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "fk_app_settings_user" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "job_embeddings" ADD CONSTRAINT "job_embeddings_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resume_embeddings" ADD CONSTRAINT "resume_embeddings_resume_id_fkey" FOREIGN KEY ("resume_id") REFERENCES "resumes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
