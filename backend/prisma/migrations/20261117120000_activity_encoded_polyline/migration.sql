-- Aktivitas disimpan 1 baris per sesi dengan rute berupa Google Encoded Polyline.
-- Perubahan bersifat aditif: kolom "routeGeoJson" dipertahankan (nullable) agar data lama tidak hilang.

-- CreateEnum
CREATE TYPE "ActivityStatus" AS ENUM ('RECORDING', 'COMPLETED');

-- AlterTable
ALTER TABLE "Activity"
  ADD COLUMN "status" "ActivityStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "encodedPolyline" TEXT,
  ADD COLUMN "startLat" DOUBLE PRECISION,
  ADD COLUMN "startLng" DOUBLE PRECISION,
  ADD COLUMN "endLat" DOUBLE PRECISION,
  ADD COLUMN "endLng" DOUBLE PRECISION,
  ADD COLUMN "elevationGain" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "locationLabel" TEXT,
  ALTER COLUMN "routeGeoJson" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Activity_userId_status_startedAt_idx" ON "Activity"("userId", "status", "startedAt" DESC);
