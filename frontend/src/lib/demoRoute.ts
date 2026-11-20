// ============================================================
// Rute DEMO: loop "Jalan Lingkar Stadion" di sekitar Stadion Utama Gelora Bung Karno (GBK), Jakarta.
// Koordinat diambil dari OpenStreetMap (© kontributor OpenStreetMap, ODbL) dan dirangkai menjadi satu loop
// tertutup sepanjang ±1 km. Dipakai mode simulasi agar gerakan mengikuti jalan sungguhan, bukan elips.
// ============================================================

import type { GeoPoint } from '../types';

/** [lat, lng] searah rangkaian way OSM; titik terakhir = titik pertama (loop tertutup). */
export const GBK_LOOP: ReadonlyArray<readonly [number, number]> = [
  [-6.21859, 106.801307],
  [-6.21838, 106.801312],
  [-6.218134, 106.801352],
  [-6.217973, 106.801405],
  [-6.217848, 106.801458],
  [-6.217713, 106.801522],
  [-6.217544, 106.801625],
  [-6.217411, 106.801738],
  [-6.217356, 106.801789],
  [-6.217319, 106.801827],
  [-6.217196, 106.801995],
  [-6.217123, 106.802138],
  [-6.217071, 106.802289],
  [-6.217045, 106.802451],
  [-6.217014, 106.802664],
  [-6.217041, 106.802841],
  [-6.217123, 106.8031],
  [-6.217215, 106.803275],
  [-6.217288, 106.80337],
  [-6.217355, 106.803467],
  [-6.217427, 106.803547],
  [-6.217545, 106.803637],
  [-6.217701, 106.803723],
  [-6.217879, 106.803808],
  [-6.218034, 106.803855],
  [-6.218233, 106.803901],
  [-6.218392, 106.803914],
  [-6.218598, 106.803924],
  [-6.218761, 106.803905],
  [-6.219023, 106.803845],
  [-6.219182, 106.80379],
  [-6.219315, 106.803741],
  [-6.219449, 106.803678],
  [-6.21959, 106.803599],
  [-6.219723, 106.803486],
  [-6.219903, 106.803259],
  [-6.220005, 106.803088],
  [-6.220066, 106.80295],
  [-6.220103, 106.802816],
  [-6.220128, 106.802656],
  [-6.220129, 106.802567],
  [-6.220108, 106.802371],
  [-6.220051, 106.802185],
  [-6.219996, 106.802061],
  [-6.2199, 106.801912],
  [-6.219781, 106.801756],
  [-6.219695, 106.801676],
  [-6.219577, 106.801601],
  [-6.219381, 106.801498],
  [-6.219213, 106.80143],
  [-6.219023, 106.801366],
  [-6.218765, 106.801321],
  [-6.21859, 106.801307],
];

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

function distanceM(a: readonly [number, number], b: readonly [number, number]): number {
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** Arah (derajat dari utara) dari a ke b. */
function bearing(a: readonly [number, number], b: readonly [number, number]): number {
  const dLng = toRad(b[1] - a[1]);
  const y = Math.sin(dLng) * Math.cos(toRad(b[0]));
  const x = Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) - Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Jarak kumulatif (m) di tiap titik loop. */
const CUMULATIVE: number[] = GBK_LOOP.reduce<number[]>((acc, p, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + distanceM(GBK_LOOP[i - 1], p));
  return acc;
}, []);

export const GBK_LOOP_LENGTH_M = CUMULATIVE[CUMULATIVE.length - 1];

/** Posisi + arah pada jarak `meters` dari titik awal, berulang mengikuti loop. */
export function pointOnLoop(meters: number): { lat: number; lng: number; heading: number } {
  const m = ((meters % GBK_LOOP_LENGTH_M) + GBK_LOOP_LENGTH_M) % GBK_LOOP_LENGTH_M;
  let i = 1;
  while (i < CUMULATIVE.length - 1 && CUMULATIVE[i] < m) i++;
  const a = GBK_LOOP[i - 1];
  const b = GBK_LOOP[i];
  const span = CUMULATIVE[i] - CUMULATIVE[i - 1] || 1;
  const t = (m - CUMULATIVE[i - 1]) / span;
  return { lat: a[0] + (b[0] - a[0]) * t, lng: a[1] + (b[1] - a[1]) * t, heading: bearing(a, b) };
}

/** Pace santai sasaran pelari demo (m/s): ±6:20/km. */
export const DEMO_TARGET_SPEED_MPS = 2.63;

/**
 * Pelari demo yang terasa manusiawi: kecepatan berubah pelan sekitar 6:20/km (bukan konstan), kadang melambat
 * sebentar, dengan galat GPS 1–3 m dan akurasi 5–9 m seperti di lapangan. Galat GPS asli BERKORELASI (bergeser
 * pelan dari detik ke detik), bukan loncat acak; loncat acak menambah jarak palsu ±30%.
 */
export function createDemoRunner() {
  let distance = 0;
  let speed = DEMO_TARGET_SPEED_MPS;
  let phase = Math.random() * Math.PI * 2;
  let slowTicks = 0;
  // Galat posisi (derajat) yang berevolusi pelan (proses AR(1)), bukan derau putih.
  let errLat = 0;
  let errLng = 0;

  return {
    /** Majukan 1 detik, kembalikan sampel GPS demo. */
    step(now: number): Omit<GeoPoint, 'timestamp'> & { timestamp: number } {
      phase += 0.07;
      // Kecepatan bergelombang ±8% di sekitar target, dan sesekali melambat (±3 detik) seperti menyeberang.
      if (slowTicks > 0) {
        slowTicks--;
        speed += (1.4 - speed) * 0.3;
      } else {
        if (Math.random() < 0.012) slowTicks = 3;
        speed += (DEMO_TARGET_SPEED_MPS * (1 + 0.08 * Math.sin(phase)) - speed) * 0.25;
      }
      distance += Math.max(0.6, speed);
      const p = pointOnLoop(distance);
      // Galat berkorelasi: 92% galat sebelumnya + inovasi kecil. Besar tetap ±1–3 m (1 m ≈ 0,000009°).
      errLat = errLat * 0.92 + (Math.random() - 0.5) * 0.0000045;
      errLng = errLng * 0.92 + (Math.random() - 0.5) * 0.0000045;
      return {
        lat: +(p.lat + errLat).toFixed(7),
        lng: +(p.lng + errLng).toFixed(7),
        timestamp: now,
        accuracy: 5 + Math.round(Math.random() * 4),
        speed: +speed.toFixed(2),
        heading: p.heading,
      };
    },
    /** Posisi awal (sebelum langkah pertama). */
    start(now: number) {
      const p = pointOnLoop(0);
      return { lat: p.lat, lng: p.lng, timestamp: now, accuracy: 6, speed: DEMO_TARGET_SPEED_MPS, heading: p.heading };
    },
    /** Jarak tempuh simulasi (m); dipakai uji. */
    get distance() {
      return distance;
    },
  };
}
