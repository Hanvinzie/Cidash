import type { SupabaseClient } from '@supabase/supabase-js';

// Klien Supabase hanya dipakai untuk Realtime BROADCAST (posisi live circle, hanya lewat WebSocket).
// Data aktivitas tetap lewat REST NestJS + Prisma. Kosongkan VITE_SUPABASE_* untuk mematikan live circle.

const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isRealtimeConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/** Dimuat dinamis supaya ±100 KB supabase-js tidak masuk bundle awal. */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (!isRealtimeConfigured) return null;
  if (!client) {
    const { createClient } = await import('@supabase/supabase-js');
    client = createClient(url!, anonKey!, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      realtime: { params: { eventsPerSecond: 5 } },
    });
  }
  return client;
}
