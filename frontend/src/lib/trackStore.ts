import type { ActivityType, GeoPoint } from '../types';

// ============================================================
// Penyimpanan lokal sesi rekam (IndexedDB) untuk pemulihan setelah crash / app ditutup / offline.
//
// - `points`: satu record per titik GPS yang LOLOS filter (append-only, tidak menulis ulang seluruh rute).
// - `meta`  : ringkasan sesi (jarak, durasi, titik yang sudah diterima server).
//
// Semua operasi bersifat best-effort: bila IndexedDB tidak tersedia (mis. private mode lama),
// tracker tetap jalan dari memori, hanya tanpa pemulihan.
// ============================================================

const DB_NAME = 'cidash-tracking';
const DB_VERSION = 1;
const META = 'meta';
const POINTS = 'points';
const ACTIVE_KEY = 'active';

export interface TrackMeta {
  /** UUID v4 — sekaligus id baris `Activity` di server. */
  sessionId: string;
  activityType: ActivityType;
  startedAt: number;
  status: 'running' | 'paused';
  simulated: boolean;
  distanceKm: number;
  elapsedSec: number;
  elevationGain: number;
  /** Jumlah titik awal rute yang sudah dikonfirmasi diterima server. */
  ackedCount: number;
}

export interface StoredTrack {
  meta: TrackMeta;
  points: GeoPoint[];
}

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(META)) db.createObjectStore(META);
        if (!db.objectStoreNames.contains(POINTS)) db.createObjectStore(POINTS);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

/** Operasi ditulis berurutan agar `append` titik tidak mendahului `clear`. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T | undefined> {
  const next = queue.then(job, job).catch(() => undefined) as Promise<T | undefined>;
  queue = next;
  return next;
}

function run<T>(
  db: IDBDatabase,
  stores: string[],
  mode: IDBTransactionMode,
  fn: (tx: IDBTransaction) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(stores, mode);
    const req = fn(tx);
    tx.oncomplete = () => resolve(req ? (req.result as T) : undefined);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export function saveMeta(meta: TrackMeta): Promise<void | undefined> {
  return enqueue(async () => {
    const db = await openDb();
    if (!db) return;
    await run(db, [META], 'readwrite', (tx) => {
      tx.objectStore(META).put(meta, ACTIVE_KEY);
    });
  });
}

/** Simpan titik pada indeks tertentu (indeks yang sama menimpa, dipakai saat titik awal diperhalus). */
export function savePoint(index: number, point: GeoPoint): Promise<void | undefined> {
  return enqueue(async () => {
    const db = await openDb();
    if (!db) return;
    await run(db, [POINTS], 'readwrite', (tx) => {
      tx.objectStore(POINTS).put(point, index);
    });
  });
}

export function clearTrack(): Promise<void | undefined> {
  return enqueue(async () => {
    const db = await openDb();
    if (!db) return;
    await run(db, [META, POINTS], 'readwrite', (tx) => {
      tx.objectStore(META).clear();
      tx.objectStore(POINTS).clear();
    });
  });
}

/** Muat sesi tersimpan (bila ada). Titik dibuang bila tidak berurutan agar rute tidak rusak. */
export async function loadTrack(): Promise<StoredTrack | null> {
  const result = await enqueue(async () => {
    const db = await openDb();
    if (!db) return null;
    const meta = await run<TrackMeta | undefined>(db, [META], 'readonly', (tx) =>
      tx.objectStore(META).get(ACTIVE_KEY),
    );
    if (!meta) return null;
    const points = await run<GeoPoint[]>(db, [POINTS], 'readonly', (tx) => tx.objectStore(POINTS).getAll());
    return { meta, points: points ?? [] } satisfies StoredTrack;
  });
  return result ?? null;
}
