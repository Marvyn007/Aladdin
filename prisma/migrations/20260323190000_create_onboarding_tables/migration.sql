-- Create onboarding state table
CREATE TABLE IF NOT EXISTS "user_onboarding_state" (
  "id" SERIAL PRIMARY KEY,
  "user_id" TEXT NOT NULL UNIQUE,
  "status" TEXT NOT NULL DEFAULT 'in_progress',
  "current_step" INTEGER NOT NULL DEFAULT 1,
  "started_at" TIMESTAMPTZ DEFAULT NOW(),
  "completed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE "user_onboarding_state"
  ADD CONSTRAINT "fk_onboarding_state_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "idx_onboarding_state_user_id" ON "user_onboarding_state"("user_id");

-- Create onboarding answers table
CREATE TABLE IF NOT EXISTS "user_onboarding_answers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT NOT NULL,
  "question_key" TEXT NOT NULL,
  "step_key" TEXT NOT NULL,
  "question_label" TEXT NOT NULL,
  "answer_type" TEXT NOT NULL,
  "answer_json" JSONB,
  "answer_text" TEXT,
  "order_index" INTEGER NOT NULL DEFAULT 0,
  "question_version" TEXT NOT NULL DEFAULT 'v1',
  "created_at" TIMESTAMPTZ DEFAULT NOW(),
  "updated_at" TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT "uniq_onboarding_answer" UNIQUE ("user_id", "question_key")
);

ALTER TABLE "user_onboarding_answers"
  ADD CONSTRAINT "fk_onboarding_answers_user"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS "idx_onboarding_answers_user_id" ON "user_onboarding_answers"("user_id");
CREATE INDEX IF NOT EXISTS "idx_onboarding_answers_user_step" ON "user_onboarding_answers"("user_id", "step_key");
