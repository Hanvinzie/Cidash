import type { ActivityType, GeoPoint } from '../types';

const EARTH_RADIUS_KM = 6371;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Jarak dua koordinat (km) dengan formula Haversine. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

/** Arah (derajat, 0–360 searah jarum jam dari utara) dari titik `a` menuju `b`. */
export function bearingDeg(a: GeoPoint, b: GeoPoint): number {
  const dLng = toRad(b.lng - a.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Batas kecepatan wajar (km/jam) — di atasnya dianggap kendaraan bermotor. */
export const MAX_SPEED_KMH: Record<ActivityType, number> = { run: 25, bike: 60 };

/** Detik -> "mm:ss" (atau "h:mm:ss" jika >= 1 jam). */
export function formatDuration(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = Math.floor(totalSec % 60);
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Pace dalam "m:ss" per km. Dibulatkan ke detik total agar tidak muncul "5:60". */
export function formatPace(durationSec: number, distanceKm: number): string {
  if (distanceKm < 0.01) return '—';
  const secPerKm = Math.round(durationSec / distanceKm);
  const m = Math.floor(secPerKm / 60);
  const s = secPerKm % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Pace dari detik per km → "m:ss". Di luar rentang masuk akal tampil "—". */
export function formatPaceSec(secPerKm: number): string {
  if (!Number.isFinite(secPerKm) || secPerKm <= 0 || secPerKm > 3600) return '—';
  const total = Math.round(secPerKm);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Berat badan bawaan (kg) bila pengguna belum mengisi profil. Mendekati rata-rata dewasa. */
export const DEFAULT_WEIGHT_KG = 65;
const WEIGHT_RANGE_KG = [30, 250] as const;

/**
 * MET (Metabolic Equivalent of Task) menurut kecepatan, mengacu pada Compendium of Physical Activities.
 * Titik: [km/jam, MET]. Di antara titik diinterpolasi linear supaya tidak ada lompatan di batas kecepatan.
 */
const RUN_MET: ReadonlyArray<readonly [number, number]> = [
  [4.0, 3.0], // berjalan lambat
  [6.4, 6.0],
  [8.0, 8.3],
  [9.7, 9.8],
  [11.3, 11.0],
  [12.9, 11.8],
  [14.5, 12.8],
  [16.1, 14.5],
  [17.7, 16.0],
  [19.3, 19.0],
];
const BIKE_MET: ReadonlyArray<readonly [number, number]> = [
  [8.0, 3.5],
  [16.0, 4.0],
  [19.0, 6.8],
  [22.0, 8.0],
  [25.7, 10.0],
  [30.6, 12.0],
  [35.0, 15.8],
];

function interpolate(table: ReadonlyArray<readonly [number, number]>, x: number): number {
  if (x <= table[0][0]) return table[0][1];
  for (let i = 1; i < table.length; i++) {
    const [x1, y1] = table[i];
    if (x <= x1) {
      const [x0, y0] = table[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return table[table.length - 1][1];
}

/** MET untuk jenis aktivitas dan kecepatan rata-rata (km/jam). */
export function metFor(type: ActivityType, speedKmh: number): number {
  return interpolate(type === 'run' ? RUN_MET : BIKE_MET, Math.max(0, speedKmh));
}

/** Berat badan valid (kg), selain itu kembali ke bawaan. */
export function sanitizeWeightKg(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n >= WEIGHT_RANGE_KG[0] && n <= WEIGHT_RANGE_KG[1] ? n : DEFAULT_WEIGHT_KG;
}

/**
 * Kalori (kkal) = MET × berat badan (kg) × durasi AKTIF (jam). MET mengikuti kecepatan rata-rata selama bergerak,
 * jadi lari cepat membakar lebih banyak per jam daripada jogging. Durasi aktif tidak menghitung waktu Pause.
 */
export function estimateCalories(
  distanceKm: number,
  type: ActivityType,
  durationSec: number,
  weightKg: number = DEFAULT_WEIGHT_KG,
): number {
  if (!(distanceKm > 0) || !(durationSec > 0)) return 0;
  const hours = durationSec / 3600;
  const met = metFor(type, distanceKm / hours);
  return Math.round(met * sanitizeWeightKg(weightKg) * hours);
}

/**
 * Verifikasi sisi klien (pratinjau). Verifikasi final tetap di backend.
 * Mendeteksi lonjakan kecepatan antar-titik melebihi batas aktivitas.
 */
export function detectSpeedViolation(points: GeoPoint[], type: ActivityType): boolean {
  for (let i = 1; i < points.length; i++) {
    if (points[i].gap) continue; // celah setelah jeda bukan lonjakan kecepatan
    const dtHours = (points[i].timestamp - points[i - 1].timestamp) / 3_600_000;
    if (dtHours <= 0) continue;
    const speed = haversineKm(points[i - 1], points[i]) / dtHours;
    if (speed > MAX_SPEED_KMH[type]) return true;
  }
  return false;
}
