import { ApiError, del, put, tokenStore } from './http';
import { encodeGeoPoints } from '../lib/polyline';
import type { ActivityType, GeoPoint } from '../types';

// ============================================================
// Batch sync GPS ke backend (Rule 2).
//
// Titik TIDAK dikirim satu per satu. Tracker mengumpulkan titik yang lolos filter, lalu mengirim
// delta-nya sebagai SATU encoded polyline setiap 30 detik atau setiap 15 titik (mana yang lebih dulu),
// dan segera saat Pause. Server menambahkan delta itu ke SATU baris Activity (draft) sampai Finish.
//
// Retry offline: bila batch gagal, titik tetap di buffer lokal (IndexedDB) dan ikut terkirim
// pada batch berikutnya yang berhasil, karena setiap batch selalu dimulai dari `ackedCount`.
// ============================================================

/** Kirim saat titik belum terkirim mencapai jumlah ini. */
export const BATCH_MAX_POINTS = 15;
/** Kirim paling lambat setelah interval ini sejak batch terakhir. */
export const BATCH_INTERVAL_MS = 30_000;
/** Jeda minimum antar percobaan bila batch gagal (dikali 2 tiap gagal, maks MAX_BACKOFF_MS). */
const BASE_BACKOFF_MS = 15_000;
const MAX_BACKOFF_MS = 120_000;

export interface BatchSnapshot {
  sessionId: string;
  activityType: ActivityType;
  startedAt: number;
  points: GeoPoint[];
  /** Titik [0, ackedCount) sudah diterima server. */
  ackedCount: number;
  distanceKm: number;
  elapsedSec: number;
  elevationGain: number;
}

interface BatchResponse {
  pointCount: number;
  accepted: boolean;
}

export type BatchResult =
  | { ok: true; ackedCount: number }
  /** `fatal` = jangan dicoba lagi untuk sesi ini (mis. sesi sudah selesai / bukan milik user). */
  | { ok: false; fatal: boolean };

const apiType = (t: ActivityType) => (t === 'run' ? 'RUNNING' : 'CYCLING');

/** Kirim satu batch (delta dari `ackedCount`). Selalu menghitung ulang delta, jadi aman di-retry. */
export async function sendBatch(snapshot: BatchSnapshot): Promise<BatchResult> {
  if (!tokenStore.get()) return { ok: false, fatal: false };
  const { points, sessionId } = snapshot;
  let from = Math.min(snapshot.ackedCount, points.length);

  try {
    // Maks 2 putaran: bila server melaporkan jumlah titiknya lebih kecil (batch hilang), kirim ulang dari sana.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await put<BatchResponse>(`/activities/sessions/${sessionId}/sync`, {
        type: apiType(snapshot.activityType),
        startedAt: new Date(snapshot.startedAt).toISOString(),
        fromIndex: from,
        polyline: encodeGeoPoints(points.slice(from)),
        distanceMeters: Math.round(snapshot.distanceKm * 1000),
        durationSeconds: Math.round(snapshot.elapsedSec),
        elevationGain: Math.round(snapshot.elevationGain),
      });
      if (res.accepted) return { ok: true, ackedCount: Math.min(res.pointCount, points.length) };
      from = Math.min(res.pointCount, points.length);
    }
    return { ok: false, fatal: false };
  } catch (e) {
    // 4xx (selain 401/408/429) berarti permintaan itu sendiri salah → berhenti, jangan loop.
    const fatal =
      e instanceof ApiError && e.status >= 400 && e.status < 500 && ![401, 408, 429].includes(e.status);
    return { ok: false, fatal };
  }
}

/** Buang draft di server (best-effort; draft usang juga dibersihkan server). */
export function discardSession(sessionId: string): void {
  if (!tokenStore.get()) return;
  void del(`/activities/sessions/${sessionId}`).catch(() => {});
}

/** Waktu tunggu sebelum percobaan berikutnya setelah `failures` kegagalan berturut-turut. */
export const backoffMs = (failures: number) =>
  Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** Math.max(0, failures - 1));

/** UUID v4. `crypto.randomUUID` hanya ada di secure context; fallback untuk jaga-jaga. */
export function newSessionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}
