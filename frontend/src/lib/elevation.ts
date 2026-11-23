// ============================================================
// Elevation gain dari altimeter GPS.
//
// `coords.altitude` ponsel berisik (±10–30 m) dan kadang melompat. Menjumlahkan setiap kenaikan mentah membuat
// elevation gain membengkak berkali lipat. Pipeline di sini:
//   1. buang sampel dengan akurasi vertikal buruk,
//   2. buang lonjakan sesaat (mustahil naik belasan meter dalam satu sampel),
//   3. median 9 sampel (membuang pencilan) lalu EMA (meredam sisa noise),
//   4. hitung gain dengan histeresis: hanya setelah naik ≥ stepM dari titik acuan, turun hanya menggeser acuan.
// ============================================================

export interface ElevationTracker {
  /** Masukkan satu sampel; mengembalikan total gain (m) sesudahnya. */
  add: (altitude: number | null | undefined, accuracy?: number | null) => number;
  gain: () => number;
}

export interface ElevationOptions {
  /** Naik minimal (m) dari titik acuan agar dihitung. */
  stepM?: number;
  /** Akurasi vertikal terburuk (m) yang masih dipercaya. */
  maxAccuracyM?: number;
  /** Selisih maksimum (m) terhadap nilai halus dalam satu sampel; lebih besar dianggap lonjakan. */
  maxJumpM?: number;
}

/** Dipilih lewat uji pada noise altimeter ±3–6 m: gain di jalan datar ≈ 0–13 m (mentah: >1700 m), tanjakan asli 50 m terukur ≈ 46 m. */
const WINDOW = 9;
const ALPHA = 0.2;
/** Setelah sekian sampel berturut-turut ditolak sebagai lonjakan, anggap itu level baru (bukan noise). */
const REBASE_AFTER = 3;

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function createElevationTracker(initialGain = 0, options: ElevationOptions = {}): ElevationTracker {
  const { stepM = 4, maxAccuracyM = 15, maxJumpM = 12 } = options;
  let window: number[] = [];
  let smooth: number | null = null;
  let ref: number | null = null;
  let gain = initialGain;
  let rejected = 0;

  return {
    add(altitude, accuracy) {
      if (altitude === null || altitude === undefined || !Number.isFinite(altitude)) return gain;
      if (accuracy !== null && accuracy !== undefined && accuracy > maxAccuracyM) return gain;

      if (smooth !== null && Math.abs(altitude - smooth) > maxJumpM) {
        rejected += 1;
        if (rejected < REBASE_AFTER) return gain;
        // Levelnya benar-benar berpindah (mis. naik lift/parkir bertingkat): mulai ulang tanpa menambah gain.
        window = [];
        smooth = null;
        ref = null;
      }
      rejected = 0;

      window.push(altitude);
      if (window.length > WINDOW) window.shift();
      const med = median(window);
      smooth = smooth === null ? med : smooth + ALPHA * (med - smooth);

      if (ref === null) {
        ref = smooth;
      } else if (smooth - ref >= stepM) {
        gain += smooth - ref;
        ref = smooth;
      } else if (ref - smooth >= stepM) {
        ref = smooth; // turun: geser acuan tanpa mengurangi gain
      }
      return gain;
    },
    gain: () => gain,
  };
}
