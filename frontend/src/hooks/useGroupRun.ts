import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../services/http';
import { acquireCircleChannel } from '../services/circleRealtime';
import {
  announceGroupChange,
  groupRunApi,
  PROGRESS_INTERVAL_MS,
  refreshRooms,
  subscribeRooms,
} from '../services/groupRun';
import type { GeoPoint, GroupRunParticipant, GroupRunRoom, User } from '../types';

type Me = Pick<User, 'id' | 'username'>;

/** Daftar sesi terbuka di circle — untuk banner Dashboard dan lobi. Satu pemuatan dibagi semua komponen. */
export function useLiveRooms(circleId: string | undefined) {
  const [rooms, setRooms] = useState<GroupRunRoom[]>([]);
  useEffect(() => {
    if (!circleId) {
      setRooms([]);
      return;
    }
    return subscribeRooms(circleId, (next) => setRooms(next));
  }, [circleId]);
  return rooms;
}

const formatGap = (km: number) => (km < 1 ? `${Math.max(1, Math.round(km * 1000))} m` : `${km.toFixed(2)} km`);

interface Options {
  me: Me;
  /** Circle aktif: dipakai memulihkan sesi yang sedang saya ikuti setelah aplikasi dibuka ulang. */
  circleId?: string;
  /** true saat tracker berjalan — progres dikirim tiap PROGRESS_INTERVAL_MS. */
  reporting: boolean;
  distanceKm: number;
  lastPoint?: GeoPoint;
}

interface Progress {
  distanceKm: number;
  point?: GeoPoint;
  updatedAt: number;
}

const isProgress = (p: unknown): p is { roomId: string; userId: string; distanceKm: number; lat?: number; lng?: number } => {
  const x = p as { roomId?: unknown; userId?: unknown; distanceKm?: unknown } | null;
  return !!x && typeof x.roomId === 'string' && typeof x.userId === 'string' && Number.isFinite(x.distanceKm);
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong.');

export function useGroupRun({ me, circleId, reporting, distanceKm, lastPoint }: Options) {
  const [roomId, setRoomId] = useState<string | null>(null);
  /** Circle tempat sesi saya berada (bisa berbeda dari circle aktif bila saya berganti circle di tengah sesi). */
  const [roomCircleId, setRoomCircleId] = useState<string | null>(null);
  const [rooms, setRooms] = useState<GroupRunRoom[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [ended, setEnded] = useState<GroupRunRoom | null>(null);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** Sesi yang sudah saya tinggalkan: jangan dipulihkan otomatis sebelum server memperbarui daftarnya. */
  const left = useRef(new Set<string>());
  const lastKnown = useRef<GroupRunRoom | null>(null);

  const watchedCircle = roomCircleId ?? circleId;

  // Daftar sesi circle (dibagi dengan Dashboard & lobi).
  useEffect(() => {
    setLoaded(false);
    if (!watchedCircle) {
      setRooms([]);
      return;
    }
    return subscribeRooms(watchedCircle, (next, isLoaded) => {
      setRooms(next);
      setLoaded(isLoaded);
    });
  }, [watchedCircle]);

  const adopt = useCallback((r: GroupRunRoom) => {
    left.current.delete(r.id);
    setRoomId(r.id);
    setRoomCircleId(r.circleId);
    setEnded(null);
    setRooms((prev) => [...prev.filter((x) => x.id !== r.id), r]);
  }, []);

  // Pulihkan sesi terbuka yang saya ikuti (mis. setelah memuat ulang halaman).
  useEffect(() => {
    if (roomId) return;
    const mine = rooms.find((r) => r.participants.some((p) => p.userId === me.id) && !left.current.has(r.id));
    if (mine) adopt(mine);
    for (const id of left.current) if (!rooms.some((r) => r.id === id)) left.current.delete(id);
  }, [rooms, roomId, me.id, adopt]);

  const listed = roomId ? rooms.find((r) => r.id === roomId) : undefined;
  if (listed) lastKnown.current = listed;

  // Sesi hilang dari daftar terbuka = selesai. Konfirmasi ke server dulu agar daftar basi tidak keliru menutup sesi.
  useEffect(() => {
    if (!roomId || !loaded || listed) return;
    let cancelled = false;
    groupRunApi
      .get(roomId)
      .then((r) => {
        if (cancelled) return;
        if (r.status === 'ended') setEnded(r);
        else adopt(r);
      })
      .catch((e) => {
        if (cancelled) return;
        if (e instanceof ApiError && (e.status === 404 || e.status === 403)) {
          setEnded(lastKnown.current ? { ...lastKnown.current, status: 'ended' } : null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [roomId, loaded, listed, adopt]);

  // Progres peserta lewat Broadcast, dan pengiriman progres saya (throttle PROGRESS_INTERVAL_MS).
  const latest = useRef({ distanceKm, lastPoint });
  latest.current = { distanceKm, lastPoint };
  useEffect(() => {
    setProgress({});
    if (!roomId || !roomCircleId) return;
    const handle = acquireCircleChannel(roomCircleId);
    if (!handle) return;
    const off = handle.on('group_progress', (payload) => {
      if (!isProgress(payload) || payload.roomId !== roomId || payload.userId === me.id) return;
      const km = Math.min(Math.max(payload.distanceKm, 0), 1000);
      const point =
        Number.isFinite(payload.lat) && Number.isFinite(payload.lng)
          ? ({ lat: payload.lat!, lng: payload.lng!, timestamp: Date.now() } as GeoPoint)
          : undefined;
      setProgress((prev) => ({ ...prev, [payload.userId]: { distanceKm: km, point, updatedAt: Date.now() } }));
    });

    let timer: ReturnType<typeof setInterval> | null = null;
    const send = () => {
      const { distanceKm: d, lastPoint: p } = latest.current;
      handle.send('group_progress', {
        roomId,
        userId: me.id,
        distanceKm: +d.toFixed(3),
        ...(p ? { lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5) } : {}),
        ts: Date.now(),
      });
    };
    if (reporting) {
      send();
      timer = setInterval(send, PROGRESS_INTERVAL_MS);
    }
    return () => {
      off();
      if (timer) {
        clearInterval(timer);
        send(); // posisi terakhir saat berhenti
      }
      handle.release();
    };
  }, [roomId, roomCircleId, reporting, me.id]);

  const run = useCallback(async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }, []);

  const afterChange = useCallback((r: GroupRunRoom) => {
    announceGroupChange(r.circleId, r.id);
    refreshRooms(r.circleId);
  }, []);

  const create = (targetCircleId: string) =>
    run(async () => {
      const r = await groupRunApi.create(targetCircleId);
      adopt(r);
      afterChange(r);
    });
  const join = (id: string) =>
    run(async () => {
      const r = await groupRunApi.join(id);
      adopt(r);
      afterChange(r);
    });
  const start = () =>
    roomId
      ? run(async () => {
          const r = await groupRunApi.start(roomId);
          adopt(r);
          afterChange(r);
        })
      : undefined;
  const finish = () =>
    roomId
      ? run(async () => {
          const r = await groupRunApi.finish(roomId);
          setEnded(r);
          afterChange(r);
        })
      : undefined;
  const leave = () =>
    roomId
      ? run(async () => {
          const id = roomId;
          const circle = roomCircleId;
          left.current.add(id);
          await groupRunApi.leave(id);
          setRoomId(null);
          setRoomCircleId(null);
          setEnded(null);
          setProgress({});
          if (circle) {
            announceGroupChange(circle, id);
            refreshRooms(circle);
          }
        })
      : undefined;

  const room = useMemo<GroupRunRoom | null>(() => {
    const base = listed ?? ended;
    if (!base) return null;
    return {
      ...base,
      // Keanggotaan dari server; jarak dari progres Broadcast (milik saya langsung dari tracker agar tanpa jeda).
      participants: base.participants.map<GroupRunParticipant>((p) =>
        p.userId === me.id
          ? { ...p, distanceKm, lastPoint, updatedAt: Date.now() }
          : { ...p, distanceKm: progress[p.userId]?.distanceKm ?? 0, lastPoint: progress[p.userId]?.point, updatedAt: progress[p.userId]?.updatedAt ?? p.updatedAt },
      ),
    };
  }, [listed, ended, progress, me.id, distanceKm, lastPoint]);

  // Live leaderboard + kalimat distance gap.
  const { ranking, gapMessage } = useMemo(() => {
    const ranking: GroupRunParticipant[] = [...(room?.participants ?? [])].sort((a, b) => b.distanceKm - a.distanceKm);
    const myIdx = ranking.findIndex((p) => p.userId === me.id);
    let gapMessage: string | null = null;
    if (myIdx === 0 && ranking.length > 1) {
      gapMessage = `You're ${formatGap(ranking[0].distanceKm - ranking[1].distanceKm)} ahead of ${ranking[1].username}`;
    } else if (myIdx > 0) {
      const ahead = ranking[myIdx - 1];
      gapMessage = `${ahead.username} is ${formatGap(ahead.distanceKm - ranking[myIdx].distanceKm)} ahead of you`;
    }
    return { ranking, gapMessage };
  }, [room, me.id]);

  return {
    room,
    isHost: room?.hostId === me.id,
    isLive: room?.status === 'live',
    ranking,
    gapMessage,
    busy,
    error,
    create,
    join,
    start,
    finish,
    leave,
  };
}
