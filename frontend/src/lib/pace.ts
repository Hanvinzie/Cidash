// ============================================================
// Pace berjalan (detik per km) yang halus.
//
// Waktu yang dipakai adalah WAKTU AKTIF (stopwatch yang berhenti saat Pause), bukan waktu dinding. Pace sesaat dari dua
// titik GPS bisa melompat ekstrem, jadi dihitung dari jendela ~30 detik terakhir lalu diperhalus dengan EMA. Sebelum data
// cukup (awal lari, atau baru Resume), nilai sebelumnya dipertahankan dan UI memakai pace rata-rata.
// ============================================================

export interface PaceSmoother {
  /** Catat total waktu aktif (detik) dan jarak kumulatif (km) saat ini. */
  add: (activeSec: number, distanceKm: number) => void;
  /** Pace halus (detik/km), atau null bila belum cukup data. */
  value: () => number | null;
}

export interface PaceOptions {
  windowSec?: number;
  /** Jarak minimum (m) dalam jendela agar pace dipercaya. */
  minDistanceM?: number;
  /** Bobot EMA: kecil = lebih halus. */
  alpha?: number;
  /** Pace lebih lambat dari ini (detik/km) dianggap berdiri/berhenti, bukan pace. */
  maxSecPerKm?: number;
}

export function createPaceSmoother(options: PaceOptions = {}): PaceSmoother {
  const { windowSec = 30, minDistanceM = 15, alpha = 0.35, maxSecPerKm = 1800 } = options;
  const samples: { t: number; d: number }[] = [];
  let ema: number | null = null;

  return {
    add(activeSec, distanceKm) {
      samples.push({ t: activeSec, d: distanceKm });
      // Pertahankan satu sampel pada/ sebelum awal jendela supaya jendela selalu mencakup ~windowSec.
      while (samples.length > 2 && activeSec - samples[1].t >= windowSec) samples.shift();

      const first = samples[0];
      const dt = activeSec - first.t;
      const dMeters = (distanceKm - first.d) * 1000;
      if (dt < 5 || dMeters < minDistanceM) return; // belum cukup: jangan melompat

      const inst = dt / (dMeters / 1000);
      if (!Number.isFinite(inst) || inst > maxSecPerKm) return;
      ema = ema === null ? inst : ema + alpha * (inst - ema);
    },
    value: () => ema,
  };
}
