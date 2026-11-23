-- Group Run: sesi lari/sepeda bersama dalam satu circle.
-- Aditif (hanya tabel & enum baru), jadi data yang sudah ada tidak tersentuh.
-- Posisi dan progres peserta TIDAK disimpan di sini; itu lewat Supabase Realtime Broadcast.

-- CreateEnum
CREATE TYPE "GroupRunStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateTable
CREATE TABLE "GroupRun" (
    "id" TEXT NOT NULL,
    "squadId" TEXT NOT NULL,
    "hostId" TEXT NOT NULL,
    "status" "GroupRunStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "GroupRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupRunParticipant" (
    "id" TEXT NOT NULL,
    "groupRunId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupRunParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GroupRun_squadId_status_idx" ON "GroupRun"("squadId", "status");

-- CreateIndex
CREATE INDEX "GroupRunParticipant_userId_idx" ON "GroupRunParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupRunParticipant_groupRunId_userId_key" ON "GroupRunParticipant"("groupRunId", "userId");

-- AddForeignKey
ALTER TABLE "GroupRun" ADD CONSTRAINT "GroupRun_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "Squad"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRun" ADD CONSTRAINT "GroupRun_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRunParticipant" ADD CONSTRAINT "GroupRunParticipant_groupRunId_fkey" FOREIGN KEY ("groupRunId") REFERENCES "GroupRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupRunParticipant" ADD CONSTRAINT "GroupRunParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
