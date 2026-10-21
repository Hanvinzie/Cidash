import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineKm } from '../lib/geo';
import { issueFromError, type LocationIssue } from '../lib/location';
import type { GeoPoint } from '../types';

export type TrackStatus = 'idle' | 'running' | 'paused' | 'finished';

const MAX_ACCURACY_M = 50; // abaikan titik GPS yang terlalu tidak akurat
const MIN_STEP_KM = 0.003; // titik < 3 m dari titik terakhir dilewati (hemat memori & kurangi jitter)
const SIM_ORIGIN = { lat: -6.2183, lng: 106.8022 }; // GBK, Jakarta
const SIM_STEP_DEG = 0.00003; // ~3.3 m/detik (pace ±5:00/km)

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Perekam rute berbasis Geolocation API.
 * `simulate` = gerakan sintetis untuk pengujian di desktop / tanpa izin lokasi.
 */
export function useGeoTracker() {
  const [status, setStatus] = useState<TrackStatus>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  /** Masalah lokasi saat merekam. 'timeout' = sinyal lemah (tracking tetap jalan). */
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const [simulated, setSimulated] = useState(false);

  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<GeoPoint | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  const addPoint = useCallback((p: GeoPoint) => {
    const prev = lastPoint.current;
    if (prev) {
      const d = haversineKm(prev, p);
      if (d < MIN_STEP_KM) return;
      setDistanceKm((km) => km + d);
    }
    lastPoint.current = p;
    setPoints((ps) => [...ps, p]);
  }, []);

  // ---- Layar tetap menyala selama merekam (GPS browser berhenti bila layar mati) ----
  const lockScreen = useCallback(async () => {
    const wl = (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock;
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
        simTimer.current = setInterval(() => {
          const prev = lastPoint.current ?? { ...SIM_ORIGIN, timestamp: Date.now() };
          addPoint({
            lat: prev.lat + SIM_STEP_DEG * (0.8 + Math.random() * 0.4),
            lng: prev.lng + SIM_STEP_DEG * (Math.random() - 0.3),
            timestamp: Date.now(),
          });
        }, 1000);
        return;
      }
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setIssue(null);
          if (pos.coords.accuracy > MAX_ACCURACY_M) return;
          addPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp });
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

  // Stopwatch hanya berjalan saat status running.
  useEffect(() => {
    if (status !== 'running') return;
    const t = setInterval(() => setElapsedSec((s) => s + 1), 1000);
    return () => clearInterval(t);
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
      if (firstPoint && !simulate) addPoint(firstPoint);
      startSources(simulate);
      setStatus('running');
    },
    [addPoint, startSources],
  );

  const pause = useCallback(() => {
    stopSources();
    lastPoint.current = null; // jangan hitung jarak "lompatan" selama jeda
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
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setIssue(null);
    setStatus('idle');
  }, [stopSources]);

  return { status, points, distanceKm, elapsedSec, issue, simulated, start, pause, resume, stop, reset };
}
