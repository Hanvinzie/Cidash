-- ============================================================================
-- CiDash PostgreSQL Security & Data Durability Hardening Script
-- 1. Enables Row-Level Security (RLS) on all public tables so Supabase's
--    public PostgREST (anon/authenticated) API cannot read or mutate rows
--    directly, while the NestJS Prisma service role (postgres) retains full access.
-- 2. Enforces database-level CHECK constraints for non-negative balances,
--    shield inventory caps (0..2), and valid workout/quest parameters.
-- ============================================================================

-- 1. Enable Row-Level Security (RLS) across all application tables
ALTER TABLE "public"."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Squad" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."SquadMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Activity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."Quest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."PointLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."CoinTransaction" ENABLE ROW LEVEL SECURITY;

-- 2. Database-level CHECK constraints (idempotent DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_coin_balance_non_negative') THEN
    ALTER TABLE "public"."User" ADD CONSTRAINT chk_user_coin_balance_non_negative CHECK ("coinBalance" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_rank_points_non_negative') THEN
    ALTER TABLE "public"."User" ADD CONSTRAINT chk_user_rank_points_non_negative CHECK ("rankPoints" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_user_shield_tickets_bounds') THEN
    ALTER TABLE "public"."User" ADD CONSTRAINT chk_user_shield_tickets_bounds CHECK ("shieldTickets" >= 0 AND "shieldTickets" <= 2);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_activity_positive_metrics') THEN
    ALTER TABLE "public"."Activity" ADD CONSTRAINT chk_activity_positive_metrics CHECK ("distanceMeters" >= 0 AND "durationSeconds" > 0 AND "averagePace" >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_quest_positive_stakes') THEN
    ALTER TABLE "public"."Quest" ADD CONSTRAINT chk_quest_positive_stakes CHECK ("targetDistance" > 0 AND "stakesPoints" >= 0);
  END IF;
END $$;
