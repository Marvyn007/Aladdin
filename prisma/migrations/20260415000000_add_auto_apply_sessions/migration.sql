-- CreateTable
CREATE TABLE "auto_apply_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "job_id" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "browserbase_session_id" TEXT,
    "live_view_url" TEXT,
    "pages_visited" INTEGER NOT NULL DEFAULT 0,
    "fields_filled_count" INTEGER NOT NULL DEFAULT 0,
    "last_event_at" TIMESTAMPTZ(6),
    "error_message" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auto_apply_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_auto_apply_sessions_user" ON "auto_apply_sessions"("user_id");

-- CreateIndex
CREATE INDEX "idx_auto_apply_sessions_status" ON "auto_apply_sessions"("status");

-- AddForeignKey
ALTER TABLE "auto_apply_sessions" ADD CONSTRAINT "auto_apply_sessions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auto_apply_sessions" ADD CONSTRAINT "auto_apply_sessions_job_id_fkey"
    FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
