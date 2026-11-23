import { http, post } from './http';
import { acquireCircleChannel, type CircleChannelHandle } from './circleRealtime';
import type { GroupRunRoom, GroupRunStatus } from '../types';

// ============================================================
// Group Run (Synchronous Session).
//
// Server (REST) menyimpan STATUS sesi dan keanggotaan: WAITING → ACTIVE → FINISHED. Posisi/progres peserta lewat
// Supabase Realtime Broadcast di channel circle (lihat circleRealtime.ts) dan tidak pernah menyentuh database.
//
// Perubahan status sampai ke klien lain lewat dua jalur: Postgres Changes pada tabel "GroupRun" (bila token Realtime
// aktif) dan sinyal Broadcast `group_changed`. Keduanya hanya MEMICU pemuatan ulang daftar sesi lewat REST, jadi
// data yang tampil selalu hasil pemeriksaan server. Tidak ada polling berulang selama channel tersambung.
// ============================================================

/** Interval kirim progres tiap klien (ms): di dalam rentang 3–5 detik, cukup halus untuk leaderboard live. */
export const PROGRESS_INTERVAL_MS = 4000;

interface ApiRoom {
  id: string;
  circleId: string;
  hostId: string;
  hostName: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
  startedAt: string | null;
  participants: { userId: string; username: string; joinedAt: string }[];
}

const STATUS: Record<ApiRoom['status'], GroupRunStatus> = { WAITING: 'lobby', ACTIVE: 'live', FINISHED: 'ended' };

export function fromApiRoom(r: ApiRoom): GroupRunRoom {
  return {
    id: r.id,
    circleId: r.circleId,
    hostId: r.hostId,
    hostName: r.hostName,
    status: STATUS[r.status] ?? 'ended',
    startedAt: r.startedAt ? Date.parse(r.startedAt) : undefined,
    participants: r.participants.map((p) => ({
      userId: p.userId,
      username: p.username,
      distanceKm: 0,
      updatedAt: Date.parse(p.joinedAt),
    })),
  };
}

export const groupRunApi = {
  list: (circleId: string) =>
    http<{ rooms: ApiRoom[] }>(`/group-runs?circleId=${encodeURIComponent(circleId)}`).then((r) => r.rooms.map(fromApiRoom)),
  get: (id: string) => http<{ room: ApiRoom }>(`/group-runs/${id}`).then((r) => fromApiRoom(r.room)),
  create: (circleId: string) => post<{ room: ApiRoom }>('/group-runs', { circleId }).then((r) => fromApiRoom(r.room)),
  join: (id: string) => post<{ room: ApiRoom }>(`/group-runs/${id}/join`).then((r) => fromApiRoom(r.room)),
  start: (id: string) => post<{ room: ApiRoom }>(`/group-runs/${id}/start`).then((r) => fromApiRoom(r.room)),
  finish: (id: string) => post<{ room: ApiRoom }>(`/group-runs/${id}/finish`).then((r) => fromApiRoom(r.room)),
  leave: (id: string) =>
    post<{ room: ApiRoom | null }>(`/group-runs/${id}/leave`).then((r) => (r.room ? fromApiRoom(r.room) : null)),
};

// ---------------- Penyimpanan daftar sesi per circle (dibagi semua komponen) ----------------

type Listener = (rooms: GroupRunRoom[], loaded: boolean) => void;

interface Store {
  circleId: string;
  rooms: GroupRunRoom[];
  loaded: boolean;
  listeners: Set<Listener>;
  handle: CircleChannelHandle | null;
  inFlight: boolean;
  dirty: boolean;
  lastFetch: number;
  timer: ReturnType<typeof setTimeout> | null;
  fallback: ReturnType<typeof setInterval> | null;
  cleanups: Array<() => void>;
}

/** Sinyal beruntun digabung: satu pemuatan dalam jendela ini. */
const DEBOUNCE_MS = 350;
/** Jeda minimum antar dua pemuatan, apa pun pemicunya. */
const MIN_GAP_MS = 1000;
/** Bila Realtime mati/terputus, kembali ke pemuatan berkala yang jarang (hanya selama terputus). */
const DEGRADED_POLL_MS = 12_000;

const stores = new Map<string, Store>();

function emit(s: Store) {
  s.listeners.forEach((l) => l(s.rooms, s.loaded));
}

async function fetchRooms(s: Store) {
  if (s.inFlight) {
    s.dirty = true;
    return;
  }
  s.inFlight = true;
  s.lastFetch = Date.now();
  try {
    s.rooms = await groupRunApi.list(s.circleId);
    s.loaded = true;
    emit(s);
  } catch {
    /* jaringan putus / ditolak: pertahankan daftar sebelumnya, jangan dikosongkan */
  } finally {
    s.inFlight = false;
    if (s.dirty) {
      s.dirty = false;
      schedule(s);
    }
  }
}

function schedule(s: Store, delay = DEBOUNCE_MS) {
  if (s.timer) return; // sudah terjadwal: sinyal ini ikut terbawa
  const wait = Math.max(delay, MIN_GAP_MS - (Date.now() - s.lastFetch));
  s.timer = setTimeout(() => {
    s.timer = null;
    void fetchRooms(s);
  }, wait);
}

function openStore(circleId: string): Store {
  const s: Store = {
    circleId,
    rooms: [],
    loaded: false,
    listeners: new Set(),
    handle: acquireCircleChannel(circleId),
    inFlight: false,
    dirty: false,
    lastFetch: 0,
    timer: null,
    fallback: null,
    cleanups: [],
  };
  const trigger = () => schedule(s);
  const h = s.handle;
  if (h) {
    s.cleanups.push(
      h.on('group_changed', trigger),
      h.onGroupRunRow(trigger),
      // Tersambung (kembali): ambil keadaan terbaru, mungkin ada sinyal yang terlewat saat putus.
      h.onStatus((connected) => connected && trigger()),
    );
  }
  const onVisible = () => document.visibilityState === 'visible' && trigger();
  document.addEventListener('visibilitychange', onVisible);
  window.addEventListener('online', trigger);
  s.cleanups.push(
    () => document.removeEventListener('visibilitychange', onVisible),
    () => window.removeEventListener('online', trigger),
  );
  // Jaring pengaman: hanya memuat saat Realtime tidak tersambung. Saat tersambung, tidak ada polling sama sekali.
  s.fallback = setInterval(() => {
    if (document.visibilityState === 'visible' && !(s.handle?.connected ?? false)) schedule(s);
  }, DEGRADED_POLL_MS);
  schedule(s, 0);
  return s;
}

function closeStore(s: Store) {
  s.cleanups.forEach((c) => c());
  if (s.timer) clearTimeout(s.timer);
  if (s.fallback) clearInterval(s.fallback);
  s.handle?.release();
  stores.delete(s.circleId);
}

/** Berlangganan daftar sesi terbuka sebuah circle. Penerima langsung diberi data terakhir yang diketahui. */
export function subscribeRooms(circleId: string, listener: Listener): () => void {
  let s = stores.get(circleId);
  if (!s) {
    s = openStore(circleId);
    stores.set(circleId, s);
  }
  s.listeners.add(listener);
  if (s.loaded) listener(s.rooms, true);
  const store = s;
  return () => {
    store.listeners.delete(listener);
    if (store.listeners.size === 0) closeStore(store);
  };
}

/** Minta pemuatan ulang segera (mis. setelah aksi saya sendiri), tanpa menunggu sinyal. */
export function refreshRooms(circleId: string) {
  const s = stores.get(circleId);
  if (s) schedule(s, 0);
}

/** Beri tahu anggota lain bahwa sesi berubah. Sinyal tanpa data: penerima memuat ulang lewat REST. */
export function announceGroupChange(circleId: string, roomId: string) {
  const store = stores.get(circleId);
  if (store?.handle) {
    store.handle.send('group_changed', { roomId, ts: Date.now() });
    return;
  }
  const h = acquireCircleChannel(circleId);
  if (!h) return;
  h.send('group_changed', { roomId, ts: Date.now() });
  setTimeout(() => h.release(), 4000); // beri waktu channel tersambung & mengirim antrean
}
