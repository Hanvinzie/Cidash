import { readBooleanSetting, SETTING_KEYS } from './settings';

// ============================================================
// Pusat notifikasi (turunan klien).
//
// Backend tidak punya konsep notifikasi/achievement, jadi daftar ini diturunkan dengan membandingkan
// snapshot circle sebelum dan sesudah tiap sinkronisasi. Snapshot pertama untuk sebuah circle hanya
// menjadi garis dasar (tidak menghasilkan notifikasi). Semuanya disimpan di localStorage per pengguna.
// ============================================================

export type NotificationKind =
  | 'member_joined'
  | 'member_left'
  | 'kicked'
  | 'bomb_received'
  | 'bomb_sent_to_other'
  | 'bomb_result'
  | 'milestone';

export interface AppNotification {
  /** Deterministik: sinkronisasi ganda tidak membuat notifikasi dobel. */
  id: string;
  kind: NotificationKind;
  /** Waktu dibuat (ms). Dibandingkan dengan "terakhir dilihat" untuk hitungan belum dibaca. */
  at: number;
  circleId: string;
  circleName: string;
  text: string;
}

export interface MemberSnap {
  id: string;
  name: string;
  rankPoints: number;
  km: number;
  rank: number;
}

export type QuestStatusSnap = 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'FAILED' | 'SHIELDED';

export interface QuestSnap {
  id: string;
  status: QuestStatusSnap;
  creatorId: string;
  creatorName: string;
  targetId: string;
  targetName: string;
}

export interface DiffContext {
  meId: string;
  circleId: string;
  circleName: string;
  now?: number;
  /** Id anggota yang saya keluarkan sendiri (captain): tidak perlu diberi tahu lagi. */
  selfRemoved?: ReadonlySet<string>;
}

export const MAX_NOTIFICATIONS = 50;
export const KM_MILESTONES = [10, 25, 50, 100] as const;
export const RP_MILESTONES = [500, 1000, 2000] as const;

const BOMB_KINDS: ReadonlySet<NotificationKind> = new Set(['bomb_received', 'bomb_sent_to_other', 'bomb_result']);

/** Bomb mengikuti pengaturan "Bomb Mission alerts", sisanya "circle"; kick selalu tampil karena penting. */
export function isKindEnabled(kind: NotificationKind): boolean {
  if (kind === 'kicked') return true;
  return BOMB_KINDS.has(kind)
    ? readBooleanSetting(SETTING_KEYS.notifyBomb, true)
    : readBooleanSetting(SETTING_KEYS.notifyGroup, true);
}

const dayStamp = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const handle = (name: string) => `@${name}`;

function make(kind: NotificationKind, id: string, ctx: DiffContext, text: string): AppNotification {
  return { id, kind, at: ctx.now ?? Date.now(), circleId: ctx.circleId, circleName: ctx.circleName, text };
}

/** Anggota baru/keluar dan pencapaian. `prev === null` berarti garis dasar: tidak ada notifikasi. */
export function diffMembers(prev: MemberSnap[] | null, next: MemberSnap[], ctx: DiffContext): AppNotification[] {
  if (!prev) return [];
  const out: AppNotification[] = [];
  const day = dayStamp(ctx.now ?? Date.now());
  const before = new Map(prev.map((m) => [m.id, m]));
  const after = new Map(next.map((m) => [m.id, m]));

  for (const m of next) {
    const old = before.get(m.id);
    if (!old) {
      if (m.id !== ctx.meId) {
        out.push(make('member_joined', `member_joined:${ctx.circleId}:${m.id}:${day}`, ctx, `${handle(m.name)} joined the circle`));
      }
      continue;
    }
    const who = m.id === ctx.meId ? 'You' : handle(m.name);
    for (const km of KM_MILESTONES) {
      if (old.km < km && m.km >= km) {
        out.push(make('milestone', `milestone:${ctx.circleId}:${m.id}:km${km}`, ctx, `${who} reached ${km} km in total`));
      }
    }
    for (const rp of RP_MILESTONES) {
      if (old.rankPoints < rp && m.rankPoints >= rp) {
        out.push(make('milestone', `milestone:${ctx.circleId}:${m.id}:rp${rp}`, ctx, `${who} reached ${rp.toLocaleString('en-US')} Rank Points`));
      }
    }
    if (next.length > 1 && old.rank !== 1 && m.rank === 1) {
      out.push(make('milestone', `milestone:${ctx.circleId}:${m.id}:top:${day}`, ctx, `${who} ${m.id === ctx.meId ? 'are' : 'is'} now #1 in the circle`));
    }
  }

  for (const m of prev) {
    if (after.has(m.id) || m.id === ctx.meId || ctx.selfRemoved?.has(m.id)) continue;
    // Klien tidak bisa membedakan keluar sendiri dan dikeluarkan captain.
    out.push(make('member_left', `member_left:${ctx.circleId}:${m.id}:${day}`, ctx, `${handle(m.name)} is no longer in the circle`));
  }
  return out;
}

const RESULT_WORD: Record<'COMPLETED' | 'FAILED' | 'SHIELDED', string> = {
  COMPLETED: 'completed',
  FAILED: 'failed',
  SHIELDED: 'blocked with a Shield Ticket',
};

/** Bomb Mission baru dan hasilnya. Hanya misi milik saya yang punya hasil akhir di server. */
export function diffQuests(prev: QuestSnap[] | null, next: QuestSnap[], ctx: DiffContext): AppNotification[] {
  if (!prev) return [];
  const out: AppNotification[] = [];
  const before = new Map(prev.map((q) => [q.id, q]));
  const after = new Set(next.map((q) => q.id));
  const mine = (q: QuestSnap) => q.creatorId === ctx.meId || q.targetId === ctx.meId;

  for (const q of next) {
    const old = before.get(q.id);
    if (!old) {
      if (q.targetId === ctx.meId && q.creatorId !== ctx.meId) {
        out.push(make('bomb_received', `bomb_received:${q.id}`, ctx, `${handle(q.creatorName)} sent you a Bomb Mission`));
      } else if (!mine(q)) {
        out.push(make('bomb_sent_to_other', `bomb_sent:${q.id}`, ctx, `${handle(q.creatorName)} sent a Bomb Mission to ${handle(q.targetName)}`));
      }
    }
    const finished = q.status === 'COMPLETED' || q.status === 'FAILED' || q.status === 'SHIELDED';
    const wasOpen = !old || old.status === 'PENDING' || old.status === 'ACCEPTED';
    if (finished && wasOpen) {
      const word = RESULT_WORD[q.status as 'COMPLETED' | 'FAILED' | 'SHIELDED'];
      const text =
        q.targetId === ctx.meId
          ? `Your Bomb Mission from ${handle(q.creatorName)} was ${word}`
          : q.creatorId === ctx.meId
            ? `${handle(q.targetName)}'s Bomb Mission from you was ${word}`
            : `${handle(q.targetName)}'s Bomb Mission from ${handle(q.creatorName)} was ${word}`;
      out.push(make('bomb_result', `bomb_result:${q.id}:${q.status}`, ctx, text));
    }
  }

  // Misi orang lain yang hilang dari daftar aktif: selesai atau kedaluwarsa, hasil pastinya tidak terlihat oleh saya.
  for (const q of prev) {
    if (after.has(q.id) || mine(q)) continue;
    if (q.status !== 'PENDING' && q.status !== 'ACCEPTED') continue;
    out.push(make('bomb_result', `bomb_result:${q.id}:ended`, ctx, `${handle(q.targetName)}'s Bomb Mission from ${handle(q.creatorName)} has ended`));
  }
  return out;
}

export function removedFromCircle(circleId: string, circleName: string, now = Date.now()): AppNotification {
  return {
    id: `kicked:${circleId}:${dayStamp(now)}`,
    kind: 'kicked',
    at: now,
    circleId,
    circleName,
    text: `You are no longer in "${circleName}". You may have been removed by the captain.`,
  };
}

/** Gabungkan notifikasi baru (filter pengaturan + dedupe id), urut terbaru dulu, maksimum 50. Mengembalikan `list` bila tak ada perubahan. */
export function mergeNotifications(list: AppNotification[], incoming: AppNotification[]): AppNotification[] {
  const seen = new Set(list.map((n) => n.id));
  const fresh = incoming.filter((n) => isKindEnabled(n.kind) && !seen.has(n.id) && (seen.add(n.id), true));
  if (fresh.length === 0) return list;
  return [...fresh, ...list].sort((a, b) => b.at - a.at).slice(0, MAX_NOTIFICATIONS);
}

// ---------------- Penyimpanan (localStorage per pengguna) ----------------

const listKey = (userId: string) => `cidash_notifs:${userId}`;
const seenKey = (userId: string) => `cidash_notifs_seen:${userId}`;
const snapKey = (userId: string, circleId: string, part: 'm' | 'q') => `cidash_snap_${part}:${userId}:${circleId}`;
const circlesKey = (userId: string) => `cidash_known_circles:${userId}`;

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as T);
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage penuh / private mode: notifikasi tetap hidup selama sesi ini */
  }
}

export const loadNotifications = (userId: string): AppNotification[] => {
  const v = readJson<AppNotification[]>(listKey(userId));
  return Array.isArray(v) ? v.filter((n) => n && typeof n.id === 'string').slice(0, MAX_NOTIFICATIONS) : [];
};
export const saveNotifications = (userId: string, list: AppNotification[]) => writeJson(listKey(userId), list);

export const loadSeenAt = (userId: string): number => {
  const v = readJson<number>(seenKey(userId));
  return typeof v === 'number' ? v : 0;
};
export const saveSeenAt = (userId: string, at: number) => writeJson(seenKey(userId), at);

export const loadSnapshot = <T>(userId: string, circleId: string, part: 'm' | 'q'): T[] | null => {
  const v = readJson<T[]>(snapKey(userId, circleId, part));
  return Array.isArray(v) ? v : null;
};
export const saveSnapshot = (userId: string, circleId: string, part: 'm' | 'q', value: unknown[]) =>
  writeJson(snapKey(userId, circleId, part), value);
export function clearSnapshots(userId: string, circleId: string) {
  try {
    localStorage.removeItem(snapKey(userId, circleId, 'm'));
    localStorage.removeItem(snapKey(userId, circleId, 'q'));
  } catch {
    /* abaikan */
  }
}

export interface KnownCircle {
  id: string;
  name: string;
}
export const loadKnownCircles = (userId: string): KnownCircle[] | null => {
  const v = readJson<KnownCircle[]>(circlesKey(userId));
  return Array.isArray(v) ? v : null;
};
export const saveKnownCircles = (userId: string, circles: KnownCircle[]) => writeJson(circlesKey(userId), circles);
