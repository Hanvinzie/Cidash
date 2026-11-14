import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineKm } from '../lib/geo';
import { issueFromError, type LocationIssue } from '../lib/location';
import type { GeoPoint } from '../types';

export type TrackStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Batas akurasi maksimum saat sudah mendapat lock satelit (di atas ini diabaikan agar rute tidak melompat). */
const MAX_TRACKING_ACCURACY_M = 55;
/** Batas akurasi awal maksimum untuk menerima titik pertama sebelum lock GPS penuh. */
const MAX_INITIAL_ACCURACY_M = 120;
/** Langkah minimum absolut dalam km (3 meter). */
const MIN_STEP_KM = 0.003;
/** Kecepatan maksimum lonjakan GPS (m/s) — di atas 35 m/s (126 km/jam) dianggap glitch/multipath spike. */
const MAX_SPIKE_SPEED_MPS = 35;
/** Parameter Kalman process noise (m/detik). */
const KALMAN_Q_MPS = 3.2;

const SIM_CENTER = { lat: -6.2183, lng: 106.8022 }; // Gelora Bung Karno, Jakarta
const SIM_RADIUS_LAT = 0.00145; // ~160m radius loop (~1 km keliling)
const SIM_RADIUS_LNG = 0.00185;
const SIM_ANGULAR_STEP = 0.021; // ~3.35 m/detik (pace ~5:00 min/km)
const SESSION_KEY = 'cidash_active_run_v1';

interface PersistedRunState {
  status: TrackStatus;
  points: GeoPoint[];
  distanceKm: number;
  elapsedSec: number;
  simulated: boolean;
}

interface KalmanState {
  lat: number;
  lng: number;
  variance: number;
  timestamp: number;
}

function loadSessionState(): PersistedRunState | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedRunState;
    if (parsed.status === 'running' || parsed.status === 'paused') {
      return { ...parsed, status: 'paused' }; // pulihkan dalam status paused agar aman setelah reload
    }
    return null;
  } catch {
    return null;
  }
}

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Perekam rute berbasis Geolocation API dengan:
 * - Kalman-style accuracy-weighted smoothing filter (meredam pantulan gedung / multipath jitter)
 * - Dynamic accuracy-gated step threshold (mencegah jarak palsu saat diam)
 * - Upgrade otomatis titik awal bila fix pertama masih kasar (Wi-Fi/Cell -> GPS satelit)
 * - Perhitungan waktu tempuh berbasis wall-clock (anti-drift saat layar redup/pindah tab)
 */
export function useGeoTracker() {
  const restored = useRef(loadSessionState());
  const [status, setStatus] = useState<TrackStatus>(restored.current?.status ?? 'idle');
  const [points, setPoints] = useState<GeoPoint[]>(restored.current?.points ?? []);
  const [distanceKm, setDistanceKm] = useState(restored.current?.distanceKm ?? 0);
  const [elapsedSec, setElapsedSec] = useState(restored.current?.elapsedSec ?? 0);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(
    restored.current?.points?.[restored.current.points.length - 1]?.accuracy ?? null,
  );
  /** Masalah lokasi saat merekam. 'timeout' = sinyal lemah (tracking tetap jalan). */
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const [simulated, setSimulated] = useState(restored.current?.simulated ?? false);

  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simAngle = useRef<number>(0);
  const lastPoint = useRef<GeoPoint | null>(
    restored.current?.points?.[restored.current.points.length - 1] ?? null,
  );
  const kalman = useRef<KalmanState | null>(null);
  const accumulatedMs = useRef<number>((restored.current?.elapsedSec ?? 0) * 1000);
  const runSegmentStartMs = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  // Simpan sesi aktif ke sessionStorage agar aman bila halaman ter-refresh
  useEffect(() => {
    try {
      if (status === 'running' || status === 'paused') {
        const snapshot: PersistedRunState = {
          status,
          points: points.slice(-500),
          distanceKm,
          elapsedSec,
          simulated,
        };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(snapshot));
      } else {
        sessionStorage.removeItem(SESSION_KEY);
      }
    } catch {
      /* sessionStorage penuh / private mode */
    }
  }, [status, points, distanceKm, elapsedSec, simulated]);

  /** Menghaluskan koordinat mentah dengan bobot varians akurasi GPS (1D/2D Kalman filter). */
  const smoothPoint = useCallback((raw: GeoPoint): GeoPoint => {
    const acc = Math.max(3, raw.accuracy ?? 10);
    const state = kalman.current;
    if (!state) {
      kalman.current = {
        lat: raw.lat,
        lng: raw.lng,
        variance: acc * acc,
        timestamp: raw.timestamp,
      };
      return { ...raw, accuracy: Math.round(acc) };
    }

    const dtSec = Math.max(0.1, (raw.timestamp - state.timestamp) / 1000);
    const predictedVariance = state.variance + dtSec * KALMAN_Q_MPS * KALMAN_Q_MPS;
    const measurementVariance = acc * acc;
    const kGain = predictedVariance / (predictedVariance + measurementVariance);

    const smoothedLat = state.lat + kGain * (raw.lat - state.lat);
    const smoothedLng = state.lng + kGain * (raw.lng - state.lng);
    const updatedVariance = (1 - kGain) * predictedVariance;

    kalman.current = {
      lat: smoothedLat,
      lng: smoothedLng,
      variance: updatedVariance,
      timestamp: raw.timestamp,
    };

    return {
      ...raw,
      lat: +smoothedLat.toFixed(7),
      lng: +smoothedLng.toFixed(7),
      accuracy: Math.round(Math.sqrt(updatedVariance)),
    };
  }, []);

  const addPoint = useCallback(
    (rawPoint: GeoPoint, isSimulation = false) => {
      const acc = rawPoint.accuracy ?? (isSimulation ? 4 : 15);
      setAccuracyMeters(Math.round(acc));

      const prev = lastPoint.current;

      // Jika titik pertama tadi berasal dari estimasi kasar (> 30m, mis. menara BTS/Wi-Fi)
      // dan dalam <= 15 detik datang fix GPS satelit yang jauh lebih tajam, ganti titik awal
      // agar tidak menggambar garis lurus palsu ratusan meter!
      if (
        prev &&
        !isSimulation &&
        (prev.accuracy ?? 15) > 30 &&
        acc < (prev.accuracy ?? 15) * 0.65 &&
        rawPoint.timestamp - prev.timestamp <= 15_000
      ) {
        kalman.current = null;
        const refined = smoothPoint(rawPoint);
        lastPoint.current = refined;
        setPoints((ps) => (ps.length <= 1 ? [refined] : [...ps.slice(0, -1), refined]));
        return;
      }

      if (prev && !isSimulation) {
        const rawDistKm = haversineKm(prev, rawPoint);
        const dtSec = Math.max(0.5, (rawPoint.timestamp - prev.timestamp) / 1000);
        const impliedSpeedMps = (rawDistKm * 1000) / dtSec;

        // Tolak lonjakan koordinat tunggal yang mustahil secara fisik (GPS multipath spike)
        if (impliedSpeedMps > MAX_SPIKE_SPEED_MPS) {
          return;
        }

        // Jika sensor kecepatan perangkat melaporkan 0 m/s dan perpindahan masih di dalam radius akurasi, abaikan drift
        if (rawPoint.speed !== undefined && rawPoint.speed !== null && rawPoint.speed < 0.35 && rawDistKm * 1000 < acc) {
          return;
        }
      }

      const p = isSimulation ? rawPoint : smoothPoint(rawPoint);

      if (prev) {
        const dKm = haversineKm(prev, p);
        // Ambang langkah dinamis berbasis akurasi GPS agar goyangan GPS saat diam tidak menambah jarak
        const minStepMeters = isSimulation
          ? 2.5
          : Math.max(MIN_STEP_KM * 1000, Math.min(12, acc * 0.35));
        if (dKm * 1000 < minStepMeters) return;
        setDistanceKm((km) => km + dKm);
      }

      lastPoint.current = p;
      setPoints((ps) => [...ps, p]);
    },
    [smoothPoint],
  );

  // ---- Layar tetap menyala selama merekam (GPS browser berhenti bila layar mati) ----
  const lockScreen = useCallback(async () => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } })
      .wakeLock;
    if (!wl || wakeLock.current) return;
    try {
      wakeLock.current = await wl.request('screen');
    } catch {
      /* ditolak (mis. baterai hemat) — tidak fatal */
    }
  }, []);
  const unlockScreen = useCallback(() => {
    void wakeLock.current?.release().catch(() => {});
    wakeLock.current = null;
  }, []);

  const stopSources = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    if (simTimer.current) clearInterval(simTimer.current);
    watchId.current = null;
    simTimer.current = null;
  }, []);

  const startSources = useCallback(
    (simulate: boolean) => {
      if (simulate) {
        if (!lastPoint.current) {
          simAngle.current = 0;
          addPoint(
            {
              lat: SIM_CENTER.lat,
              lng: SIM_CENTER.lng + SIM_RADIUS_LNG,
              timestamp: Date.now(),
              accuracy: 4,
              speed: 3.35,
            },
            true,
          );
        }
        simTimer.current = setInterval(() => {
          simAngle.current += SIM_ANGULAR_STEP;
          const t = simAngle.current;
          addPoint(
            {
              lat: +(SIM_CENTER.lat + SIM_RADIUS_LAT * Math.sin(t)).toFixed(7),
              lng: +(SIM_CENTER.lng + SIM_RADIUS_LNG * Math.cos(t)).toFixed(7),
              timestamp: Date.now(),
              accuracy: 4,
              speed: 3.35,
            },
            true,
          );
        }, 1000);
        return;
      }

      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setIssue(null);
          const acc = pos.coords.accuracy ?? 20;
          setAccuracyMeters(Math.round(acc));

          // Sebelum punya titik, izinkan hingga MAX_INITIAL_ACCURACY_M; setelah punya titik, saring ketat <= MAX_TRACKING_ACCURACY_M
          const limit = lastPoint.current ? MAX_TRACKING_ACCURACY_M : MAX_INITIAL_ACCURACY_M;
          if (acc > limit) return;

          addPoint(
            {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              timestamp: pos.timestamp || Date.now(),
              accuracy: acc,
              speed: pos.coords.speed,
            },
            false,
          );
        },
        (err) => {
          const next = issueFromError(err);
          setIssue(next);
          // Timeout = sinyal lemah sesaat: watcher tetap jalan. Izin dicabut / GPS mati = jeda.
          if (next !== 'timeout') {
            stopSources();
            lastPoint.current = null;
            setStatus('paused');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    },
    [addPoint, stopSources],
  );

  // Stopwatch berbasis wall-clock (Date.now()) agar tidak meleset saat tab di-background / layar redup.
  useEffect(() => {
    if (status !== 'running') {
      if (runSegmentStartMs.current !== null) {
        accumulatedMs.current += Date.now() - runSegmentStartMs.current;
        runSegmentStartMs.current = null;
      }
      return;
    }

    runSegmentStartMs.current = Date.now();
    const tick = () => {
      if (runSegmentStartMs.current === null) return;
      const totalMs = accumulatedMs.current + (Date.now() - runSegmentStartMs.current);
      setElapsedSec(Math.floor(totalMs / 1000));
    };

    const t = setInterval(tick, 500);
    return () => {
      clearInterval(t);
      if (runSegmentStartMs.current !== null) {
        accumulatedMs.current += Date.now() - runSegmentStartMs.current;
        runSegmentStartMs.current = null;
      }
    };
  }, [status]);

  // Wake lock dilepas browser saat tab disembunyikan — ambil lagi saat kembali.
  useEffect(() => {
    if (status !== 'running') return;
    void lockScreen();
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        wakeLock.current = null;
        void lockScreen();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      unlockScreen();
    };
  }, [status, lockScreen, unlockScreen]);

  // Bersihkan watcher & timer saat pindah halaman.
  useEffect(() => stopSources, [stopSources]);

  /** Mulai merekam. `firstPoint` = posisi hasil pre-run check (titik awal rute). */
  const start = useCallback(
    (simulate: boolean, firstPoint?: GeoPoint) => {
      setIssue(null);
      setSimulated(simulate);
      kalman.current = null;
      accumulatedMs.current = 0;
      runSegmentStartMs.current = Date.now();
      if (firstPoint && !simulate && (firstPoint.accuracy ?? 20) <= MAX_INITIAL_ACCURACY_M) {
        addPoint(firstPoint, false);
      }
      startSources(simulate);
      setStatus('running');
    },
    [addPoint, startSources],
  );

  const pause = useCallback(() => {
    stopSources();
    lastPoint.current = null; // jangan hitung jarak "lompatan" selama jeda
    kalman.current = null;
    setStatus('paused');
  }, [stopSources]);

  const resume = useCallback(() => {
    setIssue(null);
    startSources(simulated);
    setStatus('running');
  }, [simulated, startSources]);

  const stop = useCallback(() => {
    stopSources();
    setStatus('finished');
  }, [stopSources]);

  const reset = useCallback(() => {
    stopSources();
    lastPoint.current = null;
    kalman.current = null;
    simAngle.current = 0;
    accumulatedMs.current = 0;
    runSegmentStartMs.current = null;
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setAccuracyMeters(null);
    setIssue(null);
    setStatus('idle');
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      /* ignore */
    }
  }, [stopSources]);

  return {
    status,
    points,
    distanceKm,
    elapsedSec,
    accuracyMeters,
    issue,
    simulated,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
