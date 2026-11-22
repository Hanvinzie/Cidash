// ============================================================
// Penyederhanaan rute (Douglas–Peucker).
//
// Titik GPS yang sudah difilter masih bergerigi (zig-zag kecil di kiri-kanan jalan). Douglas–Peucker membuang titik
// yang menyimpang kurang dari `toleranceM` dari garis lurus antar-titik tetangganya, sehingga lintasan lebih mulus
// dan polyline lebih kecil, tanpa menggeser bentuk jalan yang sebenarnya. Titik pertama & terakhir selalu dipertahankan.
// Jarak total aktivitas TIDAK dihitung dari hasil ini (dihitung saat merekam), jadi jarak yang dilaporkan tidak berubah.
//
// `maxGapM`: di jalan lurus Douglas–Peucker bisa menyisakan dua titik berjarak berkilometer-kilometer. Backend menolak rute
// yang punya lompatan > 800 m antar titik berurutan (deteksi teleportasi), jadi tidak ada jarak antar titik yang boleh
// melebihi batas ini (bawaan 200 m, jauh di bawah batas server).
// ============================================================

interface LatLngLike {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_M = 6371000;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Jarak tegak lurus (m) titik `p` ke segmen a–b, memakai proyeksi lokal equirectangular (cukup akurat untuk rute). */
function perpendicularM(p: LatLngLike, a: LatLngLike, b: LatLngLike): number {
  const k = Math.cos(toRad(a.lat));
  const px = toRad(p.lng - a.lng) * k * EARTH_RADIUS_M;
  const py = toRad(p.lat - a.lat) * EARTH_RADIUS_M;
  const bx = toRad(b.lng - a.lng) * k * EARTH_RADIUS_M;
  const by = toRad(b.lat - a.lat) * EARTH_RADIUS_M;
  const len2 = bx * bx + by * by;
  if (len2 === 0) return Math.hypot(px, py);
  const t = Math.max(0, Math.min(1, (px * bx + py * by) / len2));
  return Math.hypot(px - t * bx, py - t * by);
}

/** Jarak lurus (m) antar dua titik, proyeksi lokal equirectangular. */
function chordM(a: LatLngLike, b: LatLngLike): number {
  const k = Math.cos(toRad(a.lat));
  return Math.hypot(toRad(b.lng - a.lng) * k * EARTH_RADIUS_M, toRad(b.lat - a.lat) * EARTH_RADIUS_M);
}

/** Sederhanakan satu segmen. Iteratif (tanpa rekursi) agar aman untuk ribuan titik. */
export function simplifySegment<T extends LatLngLike>(
  points: ReadonlyArray<T>,
  toleranceM = 3,
  maxGapM = 200,
): T[] {
  const n = points.length;
  if (n <= 2 || toleranceM <= 0) return points.slice();
  const keep = new Uint8Array(n);
  keep[0] = keep[n - 1] = 1;
  const stack: Array<[number, number]> = [[0, n - 1]];
  while (stack.length) {
    const [lo, hi] = stack.pop()!;
    let maxD = 0;
    let idx = -1;
    for (let i = lo + 1; i < hi; i++) {
      const d = perpendicularM(points[i], points[lo], points[hi]);
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (idx !== -1 && maxD > toleranceM) {
      keep[idx] = 1;
      stack.push([lo, idx], [idx, hi]);
    } else if (hi - lo > 1 && chordM(points[lo], points[hi]) > maxGapM) {
      // Cukup lurus, tetapi terlalu panjang tanpa titik: pecah di tengah agar tidak ada lompatan besar.
      const mid = (lo + hi) >> 1;
      keep[mid] = 1;
      stack.push([lo, mid], [mid, hi]);
    }
  }
  return points.filter((_, i) => keep[i] === 1);
}

/**
 * Sederhanakan seluruh rute per segmen. Titik bertanda `gap` (awal segmen baru setelah jeda) selalu dipertahankan,
 * jadi putusnya rute tidak hilang.
 */
export function simplifyRoute<T extends LatLngLike & { gap?: boolean }>(
  points: ReadonlyArray<T>,
  toleranceM = 3,
  maxGapM = 200,
): T[] {
  const out: T[] = [];
  let seg: T[] = [];
  const flush = () => {
    if (seg.length) out.push(...simplifySegment(seg, toleranceM, maxGapM));
    seg = [];
  };
  for (const p of points) {
    if (p.gap && seg.length) flush();
    seg.push(p);
  }
  flush();
  return out;
}
