import type { GroupRunProgress, GroupRunRoom, User } from '../types';

// ============================================================
// Group Run (Synchronous Session) — lapisan transport realtime.
//
// UI hanya bergantung pada interface `GroupRunTransport`.
// Saat backend siap, buat implementasi baru (Supabase Realtime atau
// WebSocket NestJS) lalu ganti export `groupRunTransport` di bawah.
//
// Saran implementasi Supabase:
//   const ch = supabase.channel(`group_run:${roomId}`)
//   ch.on('broadcast', { event: 'state' }, ({ payload }) => cb(payload)).subscribe()
//   sendProgress -> ch.send({ type: 'broadcast', event: 'progress', payload })
//   Server (NestJS) mengagregasi progress & broadcast event `state`.
// ============================================================

/** Interval kirim posisi tiap client (ms) — sesuai spesifikasi: 5 detik. */
export const PROGRESS_INTERVAL_MS = 5000;

type Me = Pick<User, 'id' | 'username'>;
type Unsubscribe = () => void;

export interface GroupRunTransport {
  /** Pantau daftar room aktif di sebuah circle (untuk banner Dashboard). */
  subscribeRooms(circleId: string, cb: (rooms: GroupRunRoom[]) => void): Unsubscribe;
  createRoom(circleId: string, me: Me): Promise<GroupRunRoom>;
  joinRoom(roomId: string, me: Me): Promise<GroupRunRoom>;
  startRoom(roomId: string, me: Me): Promise<void>;
  leaveRoom(roomId: string, me: Me): Promise<void>;
  sendProgress(progress: GroupRunProgress): void;
  /** Terima state room terbaru setiap kali server broadcast. */
  subscribeRoom(roomId: string, cb: (room: GroupRunRoom) => void): Unsubscribe;
}

// ---------------- Mock in-memory (prototype) ----------------

function createMockTransport(): GroupRunTransport {
  const rooms = new Map<string, GroupRunRoom>();
  const roomSubs = new Map<string, Set<(r: GroupRunRoom) => void>>();
  const listSubs = new Set<{ circleId: string; cb: (r: GroupRunRoom[]) => void }>();
  const botTimers = new Map<string, ReturnType<typeof setInterval>>();
  const BOT_IDS = new Set(['usr_002', 'usr_003']);

  const clone = (r: GroupRunRoom): GroupRunRoom => ({ ...r, participants: r.participants.map((p) => ({ ...p })) });
  const activeIn = (circleId: string) =>
    [...rooms.values()].filter((r) => r.circleId === circleId && r.status !== 'ended').map(clone);

  function emit(roomId: string) {
    const room = rooms.get(roomId);
    if (!room) return;
    roomSubs.get(roomId)?.forEach((cb) => cb(clone(room)));
    listSubs.forEach((s) => s.circleId === room.circleId && s.cb(activeIn(s.circleId)));
  }

  /** Simulasi peserta lain mengirim progress tiap 5 detik (~3 m/s). */
  function runBots(roomId: string) {
    if (botTimers.has(roomId)) return;
    botTimers.set(
      roomId,
      setInterval(() => {
        const room = rooms.get(roomId);
        if (!room || room.status !== 'live') return;
        room.participants.forEach((p) => {
          if (!BOT_IDS.has(p.userId)) return;
          p.distanceKm = +(p.distanceKm + 0.012 + Math.random() * 0.008).toFixed(3);
          p.updatedAt = Date.now();
        });
        emit(roomId);
      }, PROGRESS_INTERVAL_MS),
    );
  }

  // Seed: satu room live di circle pertama, di-host "dika".
  const seed: GroupRunRoom = {
    id: 'room_demo01',
    circleId: 'cir_001',
    hostId: 'usr_002',
    hostName: 'dika',
    status: 'live',
    startedAt: Date.now() - 4 * 60_000,
    participants: [
      { userId: 'usr_002', username: 'dika', distanceKm: 0.82, updatedAt: Date.now() },
      { userId: 'usr_003', username: 'rani', distanceKm: 0.61, updatedAt: Date.now() },
    ],
  };
  rooms.set(seed.id, seed);
  runBots(seed.id);

  const delay = <T>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 150)); // latensi tiruan

  return {
    subscribeRooms(circleId, cb) {
      const sub = { circleId, cb };
      listSubs.add(sub);
      cb(activeIn(circleId));
      return () => listSubs.delete(sub);
    },

    async createRoom(circleId, me) {
      const room: GroupRunRoom = {
        id: `room_${Date.now().toString(36)}`,
        circleId,
        hostId: me.id,
        hostName: me.username,
        status: 'lobby',
        participants: [{ userId: me.id, username: me.username, distanceKm: 0, updatedAt: Date.now() }],
      };
      rooms.set(room.id, room);
      emit(room.id);
      return delay(clone(room));
    },

    async joinRoom(roomId, me) {
      const room = rooms.get(roomId);
      if (!room || room.status === 'ended') throw new Error('Room not found or already ended.');
      if (!room.participants.some((p) => p.userId === me.id)) {
        room.participants.push({ userId: me.id, username: me.username, distanceKm: 0, updatedAt: Date.now() });
      }
      emit(roomId);
      return delay(clone(room));
    },

    async startRoom(roomId, me) {
      const room = rooms.get(roomId);
      if (!room || room.hostId !== me.id) throw new Error('Only the host can start the session.');
      room.status = 'live';
      room.startedAt = Date.now();
      emit(roomId);
      runBots(roomId);
      await delay(undefined);
    },

    async leaveRoom(roomId, me) {
      const room = rooms.get(roomId);
      if (!room) return;
      room.participants = room.participants.filter((p) => p.userId !== me.id);
      if (room.participants.length === 0) {
        room.status = 'ended';
        clearInterval(botTimers.get(roomId));
        botTimers.delete(roomId);
      }
      emit(roomId);
      await delay(undefined);
    },

    sendProgress({ roomId, userId, distanceKm, point }) {
      const p = rooms.get(roomId)?.participants.find((x) => x.userId === userId);
      if (!p) return;
      p.distanceKm = distanceKm;
      p.lastPoint = point;
      p.updatedAt = Date.now();
      emit(roomId);
    },

    subscribeRoom(roomId, cb) {
      if (!roomSubs.has(roomId)) roomSubs.set(roomId, new Set());
      roomSubs.get(roomId)!.add(cb);
      const room = rooms.get(roomId);
      if (room) cb(clone(room));
      return () => roomSubs.get(roomId)?.delete(cb);
    },
  };
}

// TODO: ganti dengan createSupabaseTransport() / createSocketTransport() saat backend siap.
export const groupRunTransport: GroupRunTransport = createMockTransport();
