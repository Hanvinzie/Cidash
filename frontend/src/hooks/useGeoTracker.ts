import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineKm } from '../lib/geo';
import type { GeoPoint } from '../types';

export type TrackStatus = 'idle' | 'running' | 'paused' | 'finished';

const MAX_ACCURACY_M = 50; // abaikan titik GPS yang terlalu tidak akurat
const SIM_ORIGIN = { lat: -6.2183, lng: 106.8022 }; // GBK, Jakarta
const SIM_STEP_DEG = 0.00003; // ~3.3 m/detik (pace ±5:00/km)

/**
 * Perekam rute berbasis Geolocation API.
 * `simulate` = gerakan sintetis untuk pengujian di desktop / tanpa izin lokasi.
 */
export function useGeoTracker() {
  const [status, setStatus] = useState<TrackStatus>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [simulated, setSimulated] = useState(false);

  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPoint = useRef<GeoPoint | null>(null);

  const addPoint = useCallback((p: GeoPoint) => {
    if (lastPoint.current) {
      const d = haversineKm(lastPoint.current, p);
      setDistanceKm((km) => km + d);
    }
    lastPoint.current = p;
    setPoints((ps) => [...ps, p]);
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
          if (pos.coords.accuracy > MAX_ACCURACY_M) return;
          addPoint({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp });
        },
        (err) => {
          setError(
            err.code === err.PERMISSION_DENIED
              ? 'Location permission denied. Turn on GPS or use simulation mode.'
              : 'GPS signal unavailable.',
          );
          stopSources();
          setStatus('paused');
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

  // Bersihkan watcher saat komponen di-unmount.
  useEffect(() => stopSources, [stopSources]);

  const start = useCallback(
    (simulate: boolean) => {
      const useSim = simulate || !('geolocation' in navigator);
      setError(null);
      setSimulated(useSim);
      startSources(useSim);
      setStatus('running');
    },
    [startSources],
  );

  const pause = useCallback(() => {
    stopSources();
    lastPoint.current = null; // jangan hitung jarak "lompatan" selama jeda
    setStatus('paused');
  }, [stopSources]);

  const resume = useCallback(() => {
    setError(null);
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
    setError(null);
    setStatus('idle');
  }, [stopSources]);

  return { status, points, distanceKm, elapsedSec, error, simulated, start, pause, resume, stop, reset };
}
