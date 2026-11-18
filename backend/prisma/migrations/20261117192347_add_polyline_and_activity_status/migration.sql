-- CreateEnum
CREATE TYPE "CoinTxType" AS ENUM ('TOP_UP', 'BOMB_MISSION_FEE', 'PURCHASE_SHIELD', 'REFUND');

-- AlterEnum
ALTER TYPE "PointTxType" ADD VALUE 'ACTIVITY_REWARD';

-- AlterTable
ALTER TABLE "Squad" ADD COLUMN     "createdById" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "coinBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CoinTransaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "CoinTxType" NOT NULL,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoinTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CoinTransaction_userId_createdAt_reference_idx" ON "CoinTransaction"("userId", "createdAt" DESC, "reference");

-- CreateIndex
CREATE INDEX "CoinTransaction_reference_idx" ON "CoinTransaction"("reference");

-- CreateIndex
CREATE INDEX "Activity_userId_startedAt_idx" ON "Activity"("userId", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "Activity_userId_endedAt_idx" ON "Activity"("userId", "endedAt" DESC);

-- CreateIndex
CREATE INDEX "PointLedger_userId_createdAt_idx" ON "PointLedger"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Quest_squadId_status_deadline_idx" ON "Quest"("squadId", "status", "deadline");

-- CreateIndex
CREATE INDEX "Quest_targetUserId_status_deadline_idx" ON "Quest"("targetUserId", "status", "deadline");

-- CreateIndex
CREATE INDEX "Quest_status_deadline_idx" ON "Quest"("status", "deadline");

-- CreateIndex
CREATE INDEX "SquadMember_userId_joinedAt_idx" ON "SquadMember"("userId", "joinedAt" DESC);

-- CreateIndex
CREATE INDEX "SquadMember_squadId_joinedAt_idx" ON "SquadMember"("squadId", "joinedAt" ASC);

-- CreateIndex
CREATE INDEX "User_rankPoints_idx" ON "User"("rankPoints" DESC);

-- AddForeignKey
ALTER TABLE "Squad" ADD CONSTRAINT "Squad_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoinTransaction" ADD CONSTRAINT "CoinTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
