-- Add compound index on job_scores(user_id, score DESC) for efficient For You tab queries
CREATE INDEX IF NOT EXISTS "idx_job_scores_user_score_desc"
  ON "job_scores" ("user_id", "score" DESC);
