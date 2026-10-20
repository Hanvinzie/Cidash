import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { groupRunTransport as transport, PROGRESS_INTERVAL_MS } from '../services/groupRun';
import type { GeoPoint, GroupRunParticipant, GroupRunRoom, User } from '../types';

type Me = Pick<User, 'id' | 'username'>;

/** Format selisih jarak: < 1 km dalam meter, sisanya km. */
const formatGap = (km: number) => (km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`);

/** Daftar room aktif di circle — untuk banner Dashboard. */
export function useLiveRooms(circleId: string | undefined) {
  const [rooms, setRooms] = useState<GroupRunRoom[]>([]);
  useEffect(() => {
    if (!circleId) return setRooms([]);
    return transport.subscribeRooms(circleId, setRooms);
  }, [circleId]);
  return rooms;
}

interface Options {
  me: Me;
  /** true saat tracker berjalan — progress dikirim tiap PROGRESS_INTERVAL_MS. */
  reporting: boolean;
  distanceKm: number;
  lastPoint?: GeoPoint;
}

export function useGroupRun({ me, reporting, distanceKm, lastPoint }: Options) {
  const [room, setRoom] = useState<GroupRunRoom | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomId = room?.id;

  // Subscribe ke broadcast state room.
  useEffect(() => {
    if (!roomId) return;
    return transport.subscribeRoom(roomId, setRoom);
  }, [roomId]);

  // Kirim progress periodik. Ref dipakai agar interval tidak di-reset tiap update GPS.
  const latest = useRef({ distanceKm, lastPoint });
  latest.current = { distanceKm, lastPoint };
  useEffect(() => {
    if (!roomId || !reporting) return;
    const send = () =>
      transport.sendProgress({ roomId, userId: me.id, distanceKm: latest.current.distanceKm, point: latest.current.lastPoint });
    send();
    const t = setInterval(send, PROGRESS_INTERVAL_MS);
    return () => {
      send(); // kirim posisi terakhir saat berhenti
      clearInterval(t);
    };
  }, [roomId, reporting, me.id]);

  const run = useCallback(async (fn: () => Promise<GroupRunRoom | void>) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fn();
      if (r) setRoom(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }, []);

  const create = (circleId: string) => run(() => transport.createRoom(circleId, me));
  const join = (id: string) => run(() => transport.joinRoom(id, me));
  const start = () => roomId && run(() => transport.startRoom(roomId, me));
  const leave = () =>
    roomId &&
    run(async () => {
      await transport.leaveRoom(roomId, me);
      setRoom(null);
    });

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
    leave,
  };
}
