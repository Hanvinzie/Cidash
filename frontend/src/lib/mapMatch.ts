// ============================================================
// Map-matching / snap-to-road (opsional).
//
// Menempelkan rute ke jaringan jalan lewat server OSRM-kompatibel yang Anda tentukan sendiri
// (`VITE_MAP_MATCHING_URL`). Dirancang aman terhadap rate limit:
//   - MATI secara bawaan: tanpa env, tidak ada request sama sekali.
//   - Satu request per aktivitas, hanya saat Finish (tidak pernah selama merekam).
//   - Maks 100 koordinat per request (batas bawaan OSRM) dan jeda minimal antar request.
//   - Timeout pendek; apa pun yang gagal atau mencurigakan → rute asli dipakai tanpa error.
// Jarak aktivitas tidak diubah (dihitung saat merekam); hanya bentuk garis yang dirapikan.
//
// Server demo publik OSRM hanya untuk percobaan ringan dan tidak punya profil jalan kaki; pakai server sendiri
// (OSRM / Valhalla-OSRM-API) dengan profil foot dan bike. Pola URL: https://host/match/v1/{profile}
//   {profile} → "foot" untuk lari, "bike" untuk sepeda.
// ============================================================
import { simplifySegment } from './simplify';
import type { ActivityType, GeoPoint } from '../types';

/** Batas koordinat per request (bawaan OSRM `max-matching-size`). */
export const MAX_MATCH_COORDS = 100;
const TIMEOUT_MS = 6000;
/** Jeda minimal antar request dari klien ini. */
const MIN_INTERVAL_MS = 10_000;
/** Hasil ditolak bila panjangnya menyimpang lebih dari ini dari rute asli. */
const MAX_LENGTH_DEVIATION = 0.2;
/** Hasil ditolak bila ada titik asli yang lebih jauh dari ini (m) dari garis hasil. */
const MAX_POINT_DEVIATION_M = 60;
const MIN_POINTS = 8;

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

type XY = readonly [number, number];
type Fetcher = (input: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json: () => Promise<unknown> }>;

export interface MapMatchOptions {
  /** Pola URL dengan `{profile}`. Bawaan: env VITE_MAP_MATCHING_URL. */
  baseUrl?: string;
  fetchImpl?: Fetcher;
  now?: () => number;
}

let lastRequestAt = 0;

function envUrl(): string {
  return (import.meta.env?.VITE_MAP_MATCHING_URL as string | undefined)?.trim() ?? '';
}

export const isMapMatchingEnabled = () => envUrl() !== '';

function project(points: ReadonlyArray<{ lat: number; lng: number }>, origin: { lat: number; lng: number }): XY[] {
  const k = Math.cos(toRad(origin.lat));
  return points.map((p) => [toRad(p.lng - origin.lng) * k * EARTH_RADIUS_M, toRad(p.lat - origin.lat) * EARTH_RADIUS_M] as const);
}

function pathLength(xy: XY[]): number {
  let total = 0;
  for (let i = 1; i < xy.length; i++) total += Math.hypot(xy[i][0] - xy[i - 1][0], xy[i][1] - xy[i - 1][1]);
  return total;
}

function distToPath(p: XY, path: XY[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const bx = path[i][0] - ax;
    const by = path[i][1] - ay;
    const l2 = bx * bx + by * by;
    const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * bx + (p[1] - ay) * by) / l2)) : 0;
    best = Math.min(best, Math.hypot(p[0] - ax - t * bx, p[1] - ay - t * by));
  }
  return best;
}

/** Pilih paling banyak `max` titik yang mewakili bentuk rute: sederhanakan dulu, lalu ambil merata bila masih kebanyakan. */
export function sampleForMatching<T extends { lat: number; lng: number }>(points: ReadonlyArray<T>, max = MAX_MATCH_COORDS): T[] {
  if (points.length <= max) return points.slice();
  let tolerance = 2;
  let reduced = simplifySegment(points, tolerance, 400);
  while (reduced.length > max && tolerance < 64) {
    tolerance *= 2;
    reduced = simplifySegment(points, tolerance, 400);
  }
  if (reduced.length <= max) return reduced;
  const step = (reduced.length - 1) / (max - 1);
  return Array.from({ length: max }, (_, i) => reduced[Math.round(i * step)]);
}

/**
 * Tempelkan rute ke jalan. Mengembalikan titik baru, atau null bila fitur mati, rute tidak cocok (terputus/terlalu
 * pendek), server gagal, atau hasilnya mencurigakan. Pemanggil cukup memakai rute asli saat null.
 */
export async function snapToRoads(
  points: ReadonlyArray<GeoPoint>,
  type: ActivityType,
  options: MapMatchOptions = {},
): Promise<GeoPoint[] | null> {
  const baseUrl = (options.baseUrl ?? envUrl()).trim();
  if (!baseUrl || points.length < MIN_POINTS) return null;
  if (points.some((p) => p.gap)) return null; // rute terputus: tidak dicocokkan agar tidak menyambung yang sengaja terputus

  const now = options.now ?? Date.now;
  if (now() - lastRequestAt < MIN_INTERVAL_MS) return null;
  lastRequestAt = now();

  const sample = sampleForMatching(points);
  const coords = sample.map((p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`).join(';');
  const radiuses = sample.map((p) => Math.round(Math.min(50, Math.max(15, (p.accuracy ?? 15) * 1.5)))).join(';');
  const url =
    `${baseUrl.replace('{profile}', type === 'run' ? 'foot' : 'bike').replace(/\/$/, '')}/${coords}` +
    `?geometries=geojson&overview=full&tidy=true&radiuses=${radiuses}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const doFetch: Fetcher = options.fetchImpl ?? ((u, init) => fetch(u, init));
    const res = await doFetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      code?: string;
      matchings?: Array<{ geometry?: { coordinates?: Array<[number, number]> } }>;
    };
    if (body.code !== 'Ok' || !Array.isArray(body.matchings) || body.matchings.length !== 1) return null;
    const line = body.matchings[0].geometry?.coordinates;
    if (!Array.isArray(line) || line.length < 2 || line.some((c) => !Array.isArray(c) || !Number.isFinite(c[0]) || !Number.isFinite(c[1]))) {
      return null;
    }

    // Sanity check: hasil harus tetap mewakili jalur yang sama.
    const origin = points[0];
    const originalXY = project(points, origin);
    const matchedXY = project(line.map(([lng, lat]) => ({ lat, lng })), origin);
    const lenOriginal = pathLength(project(sample, origin));
    const lenMatched = pathLength(matchedXY);
    if (lenOriginal <= 0 || Math.abs(lenMatched - lenOriginal) / lenOriginal > MAX_LENGTH_DEVIATION) return null;
    const step = Math.max(1, Math.floor(originalXY.length / 60));
    for (let i = 0; i < originalXY.length; i += step) {
      if (distToPath(originalXY[i], matchedXY) > MAX_POINT_DEVIATION_M) return null;
    }

    const t0 = points[0].timestamp;
    const t1 = points[points.length - 1].timestamp;
    return line.map(([lng, lat], i) => ({
      lat,
      lng,
      timestamp: Math.round(t0 + ((t1 - t0) * i) / Math.max(1, line.length - 1)),
    }));
  } catch {
    return null; // jaringan putus, timeout, atau JSON rusak
  } finally {
    clearTimeout(timer);
  }
}

/** Hanya untuk pengujian: reset pembatas jeda. */
export function __resetMapMatchThrottle() {
  lastRequestAt = 0;
}
