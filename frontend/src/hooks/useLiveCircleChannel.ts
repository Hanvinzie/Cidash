import { useEffect, useRef, useState } from 'react';
import { acquireCircleChannel, type CircleChannelHandle } from '../services/circleRealtime';
import { isRealtimeConfigured } from '../services/supabase';
import type { GeoPoint } from '../types';

// ============================================================
// Posisi hanya lewat WebSocket dan hidup di memori: TIDAK ada INSERT ke tabel dan TIDAK ada
// `postgres_changes`, jadi PostgreSQL tidak tersentuh sama sekali oleh pergerakan live.
// Setiap pengguna aktif memancarkan paling sering sekali per BROADCAST_INTERVAL_MS.
// ============================================================

export const LOCATION_EVENT = 'location_update';
/** Rule 3: 3–5 detik per pengguna aktif. */
export const BROADCAST_INTERVAL_MS = 4000;
/** Penanda dihapus bila tidak ada update selama ini (≈ 3 siaran terlewat). */
const STALE_AFTER_MS = 15_000;

export interface LiveMember {
  userId: string;
  username: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  updatedAt: number;
}

interface LocationPayload {
  userId: string;
  username: string;
  lat: number;
  lng: number;
  heading?: number | null;
  speed?: number | null;
  ts: number;
  /** false = pengguna berhenti berbagi → hapus penanda segera. */
  active: boolean;
}

interface Options {
  circleId?: string | null;
  me: { id: string; username: string };
  /** Berlangganan & tampilkan teman yang sedang live. */
  listen: boolean;
  /** Pancarkan posisi saya ke circle. */
  sharing: boolean;
  position?: GeoPoint | null;
}

const round5 = (n: number) => Math.round(n * 1e5) / 1e5;
const isPayload = (p: unknown): p is LocationPayload =>
  typeof p === 'object' &&
  p !== null &&
  typeof (p as LocationPayload).userId === 'string' &&
  Number.isFinite((p as LocationPayload).lat) &&
  Number.isFinite((p as LocationPayload).lng);

function buildPayload(
  me: { id: string; username: string },
  p: GeoPoint,
  activeFlag: boolean,
): LocationPayload {
  return {
    userId: me.id,
    username: me.username,
    lat: round5(p.lat),
    lng: round5(p.lng),
    heading: p.heading ?? null,
    speed: p.speed ?? null,
    ts: Date.now(),
    active: activeFlag,
  };
}

export function useLiveCircleChannel({ circleId, me, listen, sharing, position }: Options) {
  const [members, setMembers] = useState<LiveMember[]>([]);
  const [connected, setConnected] = useState(false);
  const handleRef = useRef<CircleChannelHandle | null>(null);
  const latest = useRef({ position, sharing, me });
  latest.current = { position, sharing, me };
  /** Posisi terakhir yang saya siarkan sebagai aktif; null bila teman sudah diberi tahu saya berhenti. */
  const announced = useRef<GeoPoint | null>(null);

  const active = isRealtimeConfigured && Boolean(circleId) && (listen || sharing);

  // ---- Subscriber (channel dipakai bersama fitur lain; satu WebSocket per circle) ----
  useEffect(() => {
    if (!active || !circleId) return;
    const handle = acquireCircleChannel(circleId);
    if (!handle) return;
    handleRef.current = handle;
    setConnected(handle.connected);

    const off = handle.on(LOCATION_EVENT, (payload) => {
      if (!isPayload(payload) || payload.userId === latest.current.me.id) return;
      setMembers((prev) => {
        const rest = prev.filter((m) => m.userId !== payload.userId);
        if (!payload.active) return rest;
        return [
          ...rest,
          {
            userId: payload.userId,
            username: payload.username,
            lat: payload.lat,
            lng: payload.lng,
            heading: payload.heading,
            speed: payload.speed,
            updatedAt: Date.now(),
          },
        ];
      });
    });
    const offStatus = handle.onStatus(setConnected);

    return () => {
      off();
      offStatus();
      // Beri tahu teman bahwa saya berhenti sebelum melepas channel (kalau tidak, penanda baru hilang ±15 dtk kemudian).
      // Memakai `announced` (bukan `sharing` terbaru): saat Finish, `sharing` sudah false ketika cleanup ini jalan.
      if (announced.current) {
        handle.send(LOCATION_EVENT, buildPayload(latest.current.me, announced.current, false));
        announced.current = null;
      }
      setConnected(false);
      setMembers([]);
      handleRef.current = null;
      handle.release();
    };
  }, [active, circleId]);

  // ---- Hapus penanda yang sudah tidak update ----
  useEffect(() => {
    if (!listen) return;
    const t = setInterval(() => {
      const cutoff = Date.now() - STALE_AFTER_MS;
      setMembers((prev) => (prev.some((m) => m.updatedAt < cutoff) ? prev.filter((m) => m.updatedAt >= cutoff) : prev));
    }, 5000);
    return () => clearInterval(t);
  }, [listen]);

  // ---- Publisher (throttle) ----
  useEffect(() => {
    if (!sharing || !connected) return;
    const send = (activeFlag: boolean) => {
      const { position: p, me: user } = latest.current;
      const handle = handleRef.current;
      if (!handle || !p) return;
      handle.send(LOCATION_EVENT, buildPayload(user, p, activeFlag));
      announced.current = activeFlag ? p : null;
    };
    send(true);
    const t = setInterval(() => send(true), BROADCAST_INTERVAL_MS);
    return () => {
      clearInterval(t);
      send(false); // hapus penanda saya di layar teman begitu berhenti berbagi
    };
  }, [sharing, connected]);

  return { members, connected, available: isRealtimeConfigured };
}
