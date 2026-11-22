import type { RealtimeChannel } from '@supabase/supabase-js';
import { getSupabase, isRealtimeConfigured } from './supabase';
import { http, tokenStore } from './http';

// ============================================================
// SATU channel Supabase Realtime per circle, dipakai bersama seluruh aplikasi.
//
// Sebelumnya tiap fitur membuka channel sendiri (posisi live, sinyal circle, dst). Satu WebSocket dapat memuat banyak
// channel, tetapi tiap channel punya biaya (join, heartbeat, kuota pesan). Di sini semuanya dimultipleks:
//
//   Broadcast         location_update  posisi live teman         (membawa data, tidak menyentuh database)
//                     group_progress   progres peserta Group Run (membawa data, di-throttle klien 4 detik)
//                     circle_changed   sinyal "ada yang berubah" (tanpa data → penerima memuat ulang lewat REST)
//                     group_changed    sinyal perubahan sesi Group Run (tanpa data, sama seperti di atas)
//   Presence          siapa yang sedang online / sedang berlari
//   Postgres Changes  perubahan STATUS sesi pada tabel "GroupRun" (WAITING / ACTIVE / FINISHED), hanya bila token ada
//
// Sinyal tanpa data sengaja dipertahankan: bila dipalsukan, paling buruk menimbulkan satu pemuatan ulang REST yang
// sudah dibatasi jeda minimum. Data yang sebenarnya selalu diambil dari server yang memeriksa keanggotaan circle.
// ============================================================

export type CircleEventName = 'location_update' | 'group_progress' | 'circle_changed' | 'group_changed';
const EVENTS: CircleEventName[] = ['location_update', 'group_progress', 'circle_changed', 'group_changed'];

export interface PresenceMember {
  userId: string;
  username: string;
  /** Aktivitas yang sedang direkam, atau null bila hanya online. */
  activity: 'run' | 'bike' | null;
}

export interface GroupRunRow {
  id: string;
  squadId: string;
  status: 'WAITING' | 'ACTIVE' | 'FINISHED';
}

export interface CircleChannelHandle {
  readonly circleId: string;
  readonly connected: boolean;
  on(event: CircleEventName, handler: (payload: unknown) => void): () => void;
  /** Perubahan baris tabel GroupRun (hanya terkirim bila token Realtime tersedia dan RLS mengizinkan). */
  onGroupRunRow(handler: (row: GroupRunRow) => void): () => void;
  onPresence(handler: (members: PresenceMember[]) => void): () => void;
  onStatus(handler: (connected: boolean) => void): () => void;
  /** Kirim Broadcast; bila channel belum siap, antre sebentar lalu dikirim begitu tersambung. */
  send(event: CircleEventName, payload: unknown): void;
  /** Umumkan kehadiran saya. null = berhenti mengumumkan. */
  setPresence(me: PresenceMember | null): void;
  /** Lepas referensi. Channel ditutup setelah tidak ada yang memakainya. */
  release(): void;
}

/** Tunda penutupan agar remount komponen (StrictMode, pindah halaman) tidak memutus lalu menyambung ulang. */
const CLOSE_GRACE_MS = 1500;
/** Pesan keluar yang menunggu channel siap dibuang setelah ini. */
const QUEUE_TTL_MS = 10_000;
const QUEUE_MAX = 20;
/** Perbarui token ini sebelum kedaluwarsa. */
const TOKEN_REFRESH_MARGIN_MS = 5 * 60_000;
/** Bila server belum mengaktifkan token, jangan menanyakannya terus. */
const NO_TOKEN_RETRY_MS = 5 * 60_000;

// ---------------- Token Realtime (JWT Supabase berumur pendek dari backend) ----------------

interface TokenInfo {
  token: string | null;
  expiresAt: number;
  /** Token aplikasi saat diminta: token Realtime milik akun lain tidak boleh dipakai ulang setelah ganti akun. */
  forAuth: string | null;
  circles: string[];
}

let tokenInfo: TokenInfo | null = null;
let tokenRequest: Promise<TokenInfo> | null = null;

function circlesInToken(token: string): string[] {
  try {
    const part = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(part.padEnd(part.length + ((4 - (part.length % 4)) % 4), '=')));
    return Array.isArray(payload.circles) ? payload.circles.filter((c: unknown) => typeof c === 'string') : [];
  } catch {
    return [];
  }
}

async function loadToken(): Promise<TokenInfo> {
  const forAuth = tokenStore.get();
  try {
    const res = await http<{ token: string | null; expiresAt: number | null }>('/realtime/token');
    if (!res.token || !res.expiresAt) return { token: null, expiresAt: Date.now() + NO_TOKEN_RETRY_MS, forAuth, circles: [] };
    return { token: res.token, expiresAt: res.expiresAt, forAuth, circles: circlesInToken(res.token) };
  } catch {
    return { token: null, expiresAt: Date.now() + 60_000, forAuth, circles: [] };
  }
}

/** Token yang masih berlaku dan mencakup circle ini; meminta baru bila perlu (satu permintaan sekaligus). */
async function getRealtimeToken(circleId: string): Promise<string | null> {
  const stale =
    !tokenInfo ||
    tokenInfo.forAuth !== tokenStore.get() ||
    tokenInfo.expiresAt - Date.now() < TOKEN_REFRESH_MARGIN_MS ||
    // Baru bergabung ke circle ini setelah token terbit: klaimnya belum memuat circle tersebut.
    (tokenInfo.token !== null && !tokenInfo.circles.includes(circleId));
  if (stale) {
    tokenRequest ??= loadToken().finally(() => {
      tokenRequest = null;
    });
    tokenInfo = await tokenRequest;
  }
  return tokenInfo?.token ?? null;
}

// ---------------- Entry per circle ----------------

interface Entry {
  circleId: string;
  refs: number;
  closed: boolean;
  closeTimer: ReturnType<typeof setTimeout> | null;
  channel: RealtimeChannel | null;
  connected: boolean;
  /** false setelah percobaan dengan Postgres Changes gagal: sambung ulang tanpa itu (Broadcast tetap jalan). */
  pgEnabled: boolean;
  handlers: Map<CircleEventName, Set<(payload: unknown) => void>>;
  rowHandlers: Set<(row: GroupRunRow) => void>;
  presenceHandlers: Set<(members: PresenceMember[]) => void>;
  statusHandlers: Set<(connected: boolean) => void>;
  presence: PresenceMember | null;
  queue: { event: CircleEventName; payload: unknown; at: number }[];
  refreshTimer: ReturnType<typeof setTimeout> | null;
}

const entries = new Map<string, Entry>();

function isRow(v: unknown): v is GroupRunRow {
  const r = v as GroupRunRow | null;
  return !!r && typeof r.id === 'string' && typeof r.squadId === 'string' && typeof r.status === 'string';
}

function listPresence(channel: RealtimeChannel): PresenceMember[] {
  const seen = new Map<string, PresenceMember>();
  for (const metas of Object.values(channel.presenceState() as Record<string, unknown[]>)) {
    for (const m of metas as Partial<PresenceMember>[]) {
      if (typeof m.userId !== 'string' || typeof m.username !== 'string') continue;
      const activity = m.activity === 'run' || m.activity === 'bike' ? m.activity : null;
      const prev = seen.get(m.userId);
      // Bila akun yang sama terbuka di dua perangkat, aktivitas yang sedang berjalan yang ditampilkan.
      if (!prev || (prev.activity === null && activity !== null)) seen.set(m.userId, { userId: m.userId, username: m.username, activity });
    }
  }
  return [...seen.values()];
}

function setConnected(e: Entry, connected: boolean) {
  if (e.connected === connected) return;
  e.connected = connected;
  e.statusHandlers.forEach((h) => h(connected));
}

function flushQueue(e: Entry) {
  if (!e.connected || !e.channel) return;
  const now = Date.now();
  const pending = e.queue.splice(0);
  for (const m of pending) {
    if (now - m.at <= QUEUE_TTL_MS) void e.channel.send({ type: 'broadcast', event: m.event, payload: m.payload });
  }
}

async function connect(e: Entry) {
  const sb = await getSupabase();
  if (!sb || e.closed) return;

  const token = e.pgEnabled ? await getRealtimeToken(e.circleId) : null;
  if (e.closed) return;
  if (token) sb.realtime.setAuth(token);

  const channel = sb.channel(`circle:${e.circleId}`, { config: { broadcast: { self: false } } });
  for (const event of EVENTS) {
    channel.on('broadcast', { event }, ({ payload }) => e.handlers.get(event)?.forEach((h) => h(payload)));
  }
  channel.on('presence', { event: 'sync' }, () => {
    const members = listPresence(channel);
    e.presenceHandlers.forEach((h) => h(members));
  });
  if (token) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'GroupRun', filter: `squadId=eq.${e.circleId}` },
      (change: { new?: unknown; old?: unknown }) => {
        const row = isRow(change.new) ? change.new : isRow(change.old) ? change.old : null;
        if (row) e.rowHandlers.forEach((h) => h(row));
      },
    );
  }

  e.channel = channel;
  channel.subscribe((status) => {
    if (e.closed || e.channel !== channel) return;
    if (status === 'SUBSCRIBED') {
      setConnected(e, true);
      if (e.presence) void channel.track(e.presence);
      flushQueue(e);
    } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
      setConnected(e, false);
      // Postgres Changes pada tabel yang belum diatur (publikasi/RLS) membuat seluruh channel gagal. Jangan biarkan
      // fitur lain ikut mati: sambung ulang tanpa Postgres Changes; status sesi tetap sampai lewat sinyal Broadcast.
      if (token && status === 'CHANNEL_ERROR' && e.pgEnabled) {
        e.pgEnabled = false;
        void sb.removeChannel(channel);
        e.channel = null;
        void connect(e);
      }
    }
  });

  // Perbarui token sebelum kedaluwarsa agar Postgres Changes tidak berhenti diam-diam.
  if (token && tokenInfo) {
    if (e.refreshTimer) clearTimeout(e.refreshTimer);
    const wait = Math.max(30_000, tokenInfo.expiresAt - Date.now() - TOKEN_REFRESH_MARGIN_MS);
    e.refreshTimer = setTimeout(async () => {
      if (e.closed) return;
      const fresh = await getRealtimeToken(e.circleId);
      if (fresh && !e.closed) sb.realtime.setAuth(fresh);
    }, wait);
  }
}

function teardown(e: Entry) {
  e.closed = true;
  if (e.refreshTimer) clearTimeout(e.refreshTimer);
  entries.delete(e.circleId);
  const channel = e.channel;
  e.channel = null;
  setConnected(e, false);
  if (!channel) return;
  void getSupabase().then((sb) => {
    // Beri tahu teman bahwa saya pergi sebelum channel dilepas (kalau tidak, hilang setelah heartbeat habis).
    if (e.presence) void channel.untrack();
    if (sb) void sb.removeChannel(channel);
  });
}

function makeHandle(e: Entry): CircleChannelHandle {
  let released = false;
  const subscribe = <T>(set: Set<T>, handler: T) => {
    set.add(handler);
    return () => void set.delete(handler);
  };
  return {
    circleId: e.circleId,
    get connected() {
      return e.connected;
    },
    on(event, handler) {
      let set = e.handlers.get(event);
      if (!set) e.handlers.set(event, (set = new Set()));
      return subscribe(set, handler);
    },
    onGroupRunRow: (handler) => subscribe(e.rowHandlers, handler),
    onPresence(handler) {
      if (e.channel) handler(listPresence(e.channel));
      return subscribe(e.presenceHandlers, handler);
    },
    onStatus: (handler) => subscribe(e.statusHandlers, handler),
    send(event, payload) {
      if (e.connected && e.channel) {
        void e.channel.send({ type: 'broadcast', event, payload });
        return;
      }
      e.queue.push({ event, payload, at: Date.now() });
      if (e.queue.length > QUEUE_MAX) e.queue.shift();
    },
    setPresence(me) {
      e.presence = me;
      if (!e.channel || !e.connected) return; // dikirim saat SUBSCRIBED
      if (me) void e.channel.track(me);
      else void e.channel.untrack();
    },
    release() {
      if (released) return;
      released = true;
      e.refs -= 1;
      if (e.refs <= 0 && !e.closeTimer) {
        e.closeTimer = setTimeout(() => {
          e.closeTimer = null;
          if (e.refs <= 0) teardown(e);
        }, CLOSE_GRACE_MS);
      }
    },
  };
}

/**
 * Ambil handle ke channel bersama sebuah circle. Setiap pemanggil WAJIB memanggil `release()`.
 * Mengembalikan null bila Realtime tidak dikonfigurasi (VITE_SUPABASE_*): semua fitur tetap jalan lewat REST.
 */
export function acquireCircleChannel(circleId: string): CircleChannelHandle | null {
  if (!isRealtimeConfigured || !circleId) return null;
  let e = entries.get(circleId);
  if (!e) {
    e = {
      circleId,
      refs: 0,
      closed: false,
      closeTimer: null,
      channel: null,
      connected: false,
      pgEnabled: true,
      handlers: new Map(),
      rowHandlers: new Set(),
      presenceHandlers: new Set(),
      statusHandlers: new Set(),
      presence: null,
      queue: [],
      refreshTimer: null,
    };
    entries.set(circleId, e);
    void connect(e);
  }
  if (e.closeTimer) {
    clearTimeout(e.closeTimer);
    e.closeTimer = null;
  }
  e.refs += 1;
  return makeHandle(e);
}

/** Hanya untuk pengujian. */
export function __resetCircleRealtimeForTests() {
  entries.forEach((e) => teardown(e));
  tokenInfo = null;
  tokenRequest = null;
}
