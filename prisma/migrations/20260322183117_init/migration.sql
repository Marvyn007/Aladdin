-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "name" TEXT,
    "image_url" TEXT,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "preference_embedding" vector,
    "first_name" TEXT,
    "last_name" TEXT,
    "votes" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_reputation_votes" (
    "id" UUID NOT NULL,
    "voter_id" TEXT NOT NULL,
    "target_user_id" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_reputation_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_votes" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "value" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_votes_pkey" PRIMARY KEY ("id")
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
    "geo_source" TEXT,
    "location_raw" TEXT,
    "geocoded_at" TIMESTAMPTZ(6),
    "location_dedup_key" TEXT,
    "user_id" TEXT,
    "title_normalized" TEXT,
    "company_normalized" TEXT,
    "location_normalized" TEXT,
    "search_title_tokens" tsvector,
    "search_company_tokens" tsvector,
    "search_location_tokens" tsvector,
    "search_content" tsvector,
    "search_boost_score" DOUBLE PRECISION DEFAULT 1.0,
    "common_title_category" TEXT,
    "posted_by_user_id" TEXT,
    "source" TEXT,
    "external_id" TEXT,
    "salary_min" DOUBLE PRECISION,
    "salary_max" DOUBLE PRECISION,
    "salary_currency" TEXT,
    "job_type" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "experience_level" TEXT,
    "skills" JSONB NOT NULL DEFAULT '[]',
    "apply_url" TEXT,
    "expires_at" TIMESTAMPTZ(6),

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
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "upvotes" INTEGER DEFAULT 0,
    "downvotes" INTEGER DEFAULT 0,
    "poster_first_name" TEXT,
    "poster_last_name" TEXT,
    "poster_image_url" TEXT,

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
    "archived_at" TIMESTAMPTZ(6),

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
CREATE TABLE "companies" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "logo_url" TEXT,
    "logo_fetched" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
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
    "embedding" vector,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_embeddings_pkey" PRIMARY KEY ("job_id")
);

-- CreateTable
CREATE TABLE "resume_embeddings" (
    "resume_id" UUID NOT NULL,
    "embedding" vector,
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
    "embedding" vector,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_geo_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "location_label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "source" TEXT,
    "raw_location_text" TEXT,
    "is_user_corrected" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_geo_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_analytics" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "query_text" TEXT NOT NULL,
    "query_normalized" TEXT,
    "results_count" INTEGER,
    "clicked_job_id" UUID,
    "user_id" TEXT,
    "session_id" TEXT,
    "search_duration_ms" INTEGER,
    "filters_used" JSONB,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_analytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "search_suggestions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "term" TEXT NOT NULL,
    "term_type" TEXT NOT NULL,
    "frequency" INTEGER DEFAULT 1,
    "last_seen_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_suggestions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "interview_experiences" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "work_option" TEXT NOT NULL,
    "offer_status" TEXT NOT NULL,
    "salary_hourly" DOUBLE PRECISION,
    "applied_date" DATE,
    "offer_date" DATE,
    "process_steps" JSONB NOT NULL DEFAULT '[]',
    "interview_details" JSONB NOT NULL DEFAULT '{}',
    "additional_comments" TEXT,
    "outcome" TEXT DEFAULT 'Pending',
    "offer_details" TEXT,
    "is_remote" BOOLEAN NOT NULL DEFAULT false,
    "is_flagged" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'published',
    "moderation_notes" TEXT,
    "last_edited_by" TEXT,
    "last_edited_at" TIMESTAMPTZ(6),
    "edit_history" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "interview_experiences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tailored_resumes" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "resume_data" JSONB NOT NULL,
    "keywords_data" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tailored_resumes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_scores" (
    "id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "score" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL,
    "extracted_meta" JSONB,
    "scored_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_queue" (
    "id" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "source" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "run_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 3,
    "last_error" TEXT,
    "locked_at" TIMESTAMPTZ(6),
    "locked_by" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),

    CONSTRAINT "job_queue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tracked_companies" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ats" TEXT NOT NULL,
    "industry" TEXT,
    "country" TEXT,
    "website_url" TEXT,
    "logo_url" TEXT,
    "added_by" TEXT NOT NULL DEFAULT 'seed',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "suspect_empty" BOOLEAN NOT NULL DEFAULT false,
    "last_polled_at" TIMESTAMPTZ(6),
    "last_non_empty_at" TIMESTAMPTZ(6),
    "last_job_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tracked_companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "source_poll_logs" (
    "id" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "slug" TEXT,
    "jobs_fetched" INTEGER NOT NULL,
    "new_jobs" INTEGER NOT NULL,
    "duplicates" INTEGER NOT NULL,
    "duration_ms" INTEGER NOT NULL,
    "error" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "source_poll_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_users_email" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_reputation_vote" ON "user_reputation_votes"("voter_id", "target_user_id");

-- CreateIndex
CREATE INDEX "idx_job_vote_job_id" ON "job_votes"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_job_vote" ON "job_votes"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_jobs_fetched_at" ON "jobs"("fetched_at" DESC);

-- CreateIndex
CREATE INDEX "idx_jobs_content_hash" ON "jobs"("content_hash");

-- CreateIndex
CREATE INDEX "idx_jobs_import_tag" ON "jobs"("import_tag");

-- CreateIndex
CREATE INDEX "idx_jobs_status" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "idx_jobs_user_id" ON "jobs"("user_id");

-- CreateIndex
CREATE INDEX "idx_jobs_posted_by_user_id" ON "jobs"("posted_by_user_id");

-- CreateIndex
CREATE INDEX "idx_jobs_title_normalized" ON "jobs"("title_normalized");

-- CreateIndex
CREATE INDEX "idx_jobs_company_normalized" ON "jobs"("company_normalized");

-- CreateIndex
CREATE INDEX "idx_jobs_location_normalized" ON "jobs"("location_normalized");

-- CreateIndex
CREATE INDEX "idx_jobs_company_trgm" ON "jobs" USING GIN ("company" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_jobs_location_trgm" ON "jobs" USING GIN ("location" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_jobs_search_company" ON "jobs" USING GIN ("search_company_tokens");

-- CreateIndex
CREATE INDEX "idx_jobs_search_content" ON "jobs" USING GIN ("search_content");

-- CreateIndex
CREATE INDEX "idx_jobs_search_location" ON "jobs" USING GIN ("search_location_tokens");

-- CreateIndex
CREATE INDEX "idx_jobs_search_title" ON "jobs" USING GIN ("search_title_tokens");

-- CreateIndex
CREATE INDEX "idx_jobs_title_trgm" ON "jobs" USING GIN ("title" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "idx_jobs_source_external_id" ON "jobs"("source", "external_id");

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
CREATE UNIQUE INDEX "companies_name_key" ON "companies"("name");

-- CreateIndex
CREATE INDEX "idx_companies_name" ON "companies"("name");

-- CreateIndex
CREATE INDEX "job_embeddings_embedding_idx" ON "job_embeddings"("embedding");

-- CreateIndex
CREATE INDEX "idx_user_interactions_user_job" ON "user_interactions"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_user_interactions_created_at" ON "user_interactions"("created_at");

-- CreateIndex
CREATE INDEX "idx_search_history_user_created" ON "search_history"("user_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_job_geo_points_job_id" ON "job_geo_points"("job_id");

-- CreateIndex
CREATE INDEX "idx_job_geo_points_lat_lng" ON "job_geo_points"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "idx_search_analytics_query" ON "search_analytics"("query_normalized");

-- CreateIndex
CREATE INDEX "idx_search_analytics_created" ON "search_analytics"("created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_search_analytics_user" ON "search_analytics"("user_id");

-- CreateIndex
CREATE INDEX "idx_search_analytics_aggregated" ON "search_analytics"("query_normalized", "created_at", "results_count", "user_id");

-- CreateIndex
CREATE INDEX "idx_search_analytics_query_created" ON "search_analytics"("query_normalized", "created_at" DESC);

-- CreateIndex
CREATE INDEX "idx_search_analytics_user_query" ON "search_analytics"("user_id", "query_normalized", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "search_suggestions_term_key" ON "search_suggestions"("term");

-- CreateIndex
CREATE INDEX "idx_search_suggestions_term" ON "search_suggestions"("term");

-- CreateIndex
CREATE INDEX "idx_search_suggestions_type" ON "search_suggestions"("term_type");

-- CreateIndex
CREATE INDEX "idx_search_suggestions_freq" ON "search_suggestions"("frequency" DESC);

-- CreateIndex
CREATE INDEX "idx_interview_exp_company" ON "interview_experiences"("company_name");

-- CreateIndex
CREATE INDEX "idx_interview_exp_user" ON "interview_experiences"("user_id");

-- CreateIndex
CREATE INDEX "idx_tailored_resume_user_id" ON "tailored_resumes"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_tailored_resume_user_job" ON "tailored_resumes"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_job_score_user_id" ON "job_scores"("user_id");

-- CreateIndex
CREATE INDEX "idx_job_score_job_id" ON "job_scores"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_job_score_user_job" ON "job_scores"("user_id", "job_id");

-- CreateIndex
CREATE INDEX "idx_job_queue_dequeue" ON "job_queue"("status", "run_at", "priority");

-- CreateIndex
CREATE INDEX "idx_job_queue_status_created" ON "job_queue"("status", "created_at");

-- CreateIndex
CREATE INDEX "idx_tracked_company_ats_active" ON "tracked_companies"("ats", "is_active");

-- CreateIndex
CREATE INDEX "idx_tracked_company_active_polled" ON "tracked_companies"("is_active", "last_polled_at");

-- CreateIndex
CREATE UNIQUE INDEX "uniq_tracked_company_slug_ats" ON "tracked_companies"("slug", "ats");

-- CreateIndex
CREATE INDEX "idx_source_poll_log_source_created" ON "source_poll_logs"("source", "created_at");

-- CreateIndex
CREATE INDEX "idx_source_poll_log_created" ON "source_poll_logs"("created_at");

-- AddForeignKey
ALTER TABLE "user_reputation_votes" ADD CONSTRAINT "user_reputation_votes_voter_id_fkey" FOREIGN KEY ("voter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_reputation_votes" ADD CONSTRAINT "user_reputation_votes_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_votes" ADD CONSTRAINT "job_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_votes" ADD CONSTRAINT "job_votes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "fk_jobs_posted_by_user" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

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
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_interactions" ADD CONSTRAINT "user_interactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_history" ADD CONSTRAINT "search_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_geo_points" ADD CONSTRAINT "job_geo_points_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_clicked_job_id_fkey" FOREIGN KEY ("clicked_job_id") REFERENCES "jobs"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "search_analytics" ADD CONSTRAINT "search_analytics_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_company_name_fkey" FOREIGN KEY ("company_name") REFERENCES "companies"("name") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "interview_experiences" ADD CONSTRAINT "interview_experiences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tailored_resumes" ADD CONSTRAINT "tailored_resumes_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
