-- ============================================================================
-- Supabase Realtime untuk Group Run (Postgres Changes pada perubahan STATUS sesi).
--
-- Jalankan sekali setelah `npm run db:push` (atau migrasi): npm run db:realtime
-- Idempoten dan aman di PostgreSQL biasa (tanpa skema `auth` / publikasi supabase_realtime): bagian yang tidak
-- didukung dilewati dengan NOTICE.
--
-- Cara kerja keamanan:
--   * Aplikasi memakai JWT NestJS, bukan Supabase Auth, sehingga klien Supabase hanya membawa anon key publik.
--   * Endpoint GET /realtime/token menerbitkan JWT berumur pendek (ditandatangani SUPABASE_JWT_SECRET) dengan klaim
--     `circles`: daftar id circle milik pengguna.
--   * Policy di bawah hanya mengizinkan role `authenticated` membaca baris GroupRun milik circle di klaim itu, dan
--     TIDAK ada policy untuk `anon`. Tanpa token, Postgres Changes tidak mengirim apa pun.
--   * Tabel ini hanya berisi id, status, dan waktu. Nama dan posisi peserta tidak pernah ada di sini.
-- ============================================================================

ALTER TABLE "public"."GroupRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."GroupRunParticipant" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regprocedure('auth.jwt()') IS NULL THEN
    RAISE NOTICE 'auth.jwt() tidak ada (bukan Supabase): policy realtime dilewati.';
  ELSE
    DROP POLICY IF EXISTS "group_run_circle_members_read" ON "public"."GroupRun";
    CREATE POLICY "group_run_circle_members_read" ON "public"."GroupRun"
      FOR SELECT TO authenticated
      USING (
        "squadId" IN (
          SELECT jsonb_array_elements_text(coalesce(auth.jwt() -> 'circles', '[]'::jsonb))
        )
      );
  END IF;

  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'GroupRun'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE "public"."GroupRun";
    END IF;
  ELSE
    RAISE NOTICE 'Publikasi supabase_realtime tidak ada: tabel tidak didaftarkan.';
  END IF;
END $$;
