import { useCallback, useEffect, useRef } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isRealtimeConfigured } from '../services/supabase';

// ============================================================
// Sinyal "circle berubah" lewat Supabase Realtime BROADCAST (opsional, bila VITE_SUPABASE_* terisi).
//
// Event TIDAK membawa data: penerima hanya memicu refresh lewat REST. Karena itu aman walau dipalsukan
// (paling buruk satu refresh ekstra, dan refresh sudah dibatasi jeda minimum). Tidak memakai
// `postgres_changes` karena tabel di-hardening RLS (anon tidak bisa membacanya).
// ============================================================

export const CIRCLE_EVENT = 'circle_changed';
/** Siaran keluar paling cepat sekali per detik. */
const SEND_GAP_MS = 1000;
/** Sinyal yang menunggu channel siap dibuang setelah ini. */
const PENDING_TTL_MS = 10_000;

interface Options {
  circleId?: string | null;
  enabled: boolean;
  /** Dipanggil saat anggota lain memberi sinyal. */
  onSignal: () => void;
}

export function useCircleEvents({ circleId, enabled, onSignal }: Options) {
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;
  const entry = useRef<{ circleId: string; channel: RealtimeChannel; ready: boolean } | null>(null);
  const pending = useRef(new Map<string, number>());
  const lastSent = useRef(0);

  const flush = useCallback(() => {
    const e = entry.current;
    if (!e?.ready) return;
    const queuedAt = pending.current.get(e.circleId);
    if (queuedAt === undefined) return;
    pending.current.delete(e.circleId);
    const now = Date.now();
    if (now - queuedAt > PENDING_TTL_MS || now - lastSent.current < SEND_GAP_MS) return;
    lastSent.current = now;
    void e.channel.send({ type: 'broadcast', event: CIRCLE_EVENT, payload: { ts: now } });
  }, []);

  useEffect(() => {
    if (!isRealtimeConfigured || !enabled || !circleId) return;
    let cancelled = false;
    let channel: RealtimeChannel | null = null;
    let supabase: Awaited<ReturnType<typeof getSupabase>> = null;

    void getSupabase().then((sb) => {
      if (cancelled || !sb) return;
      supabase = sb;
      channel = sb.channel(`circle-events:${circleId}`, { config: { broadcast: { self: false } } });
      const current = { circleId, channel, ready: false };
      entry.current = current;
      channel
        .on('broadcast', { event: CIRCLE_EVENT }, () => onSignalRef.current())
        .subscribe((status) => {
          current.ready = status === 'SUBSCRIBED';
          if (current.ready) flush();
        });
    });

    return () => {
      cancelled = true;
      entry.current = null;
      if (channel && supabase) void supabase.removeChannel(channel);
    };
  }, [circleId, enabled, flush]);

  /** Beri tahu anggota lain bahwa circle ini berubah. Menunggu channel siap bila perlu (mis. baru bergabung). */
  const notify = useCallback(
    (id: string) => {
      if (!isRealtimeConfigured) return;
      pending.current.set(id, Date.now());
      flush();
    },
    [flush],
  );

  return { notify };
}
