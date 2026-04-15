-- Apply Pilot: per-user JSON payload for ATS screening answers
CREATE TABLE "apply_pilot_profiles" (
    "user_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "apply_pilot_profiles_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "apply_pilot_profiles" ADD CONSTRAINT "apply_pilot_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
