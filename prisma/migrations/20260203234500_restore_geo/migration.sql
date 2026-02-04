-- AlterTable
ALTER TABLE "jobs" ADD COLUMN "geo_source" TEXT;

-- CreateTable
CREATE TABLE "job_geo_points" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "job_id" UUID NOT NULL,
    "location_label" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "confidence" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_geo_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_job_geo_points_job_id" ON "job_geo_points"("job_id");

-- CreateIndex
CREATE INDEX "idx_job_geo_points_lat_lng" ON "job_geo_points"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "job_geo_points" ADD CONSTRAINT "job_geo_points_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
