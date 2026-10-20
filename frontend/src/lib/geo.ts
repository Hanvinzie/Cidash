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

/** Estimasi kalori kasar berbasis jarak (kkal/km). */
export function estimateCalories(distanceKm: number, type: ActivityType): number {
  return Math.round(distanceKm * (type === 'run' ? 62 : 28));
}

/**
 * Verifikasi sisi klien (pratinjau). Verifikasi final tetap di backend.
 * Mendeteksi lonjakan kecepatan antar-titik melebihi batas aktivitas.
 */
export function detectSpeedViolation(points: GeoPoint[], type: ActivityType): boolean {
  for (let i = 1; i < points.length; i++) {
    const dtHours = (points[i].timestamp - points[i - 1].timestamp) / 3_600_000;
    if (dtHours <= 0) continue;
    const speed = haversineKm(points[i - 1], points[i]) / dtHours;
    if (speed > MAX_SPEED_KMH[type]) return true;
  }
  return false;
}
