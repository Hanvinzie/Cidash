-- Bomb Mission menyimpan koin yang dibayar dan tingkat kesulitannya.
-- Aditif: kolom nullable, jadi quest lama tetap valid (refund Shield jatuh ke perkiraan lama).

-- CreateEnum
CREATE TYPE "QuestDifficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD', 'HELL');

-- AlterTable
ALTER TABLE "Quest"
  ADD COLUMN "wagerCoins" INTEGER,
  ADD COLUMN "difficulty" "QuestDifficulty";
