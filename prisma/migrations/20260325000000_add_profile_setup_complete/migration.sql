-- Add profile_setup_complete boolean to user_onboarding_state
-- Tracks whether user has completed all 3 setup steps (resume + linkedin + preferences)
ALTER TABLE "user_onboarding_state"
  ADD COLUMN IF NOT EXISTS "profile_setup_complete" BOOLEAN NOT NULL DEFAULT false;
