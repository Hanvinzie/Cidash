import { useCallback, useEffect, useRef, useState } from 'react';
import { haversineKm } from '../lib/geo';
import { setGeocodeLocked } from '../lib/geocode';
import { issueFromError, type LocationIssue } from '../lib/location';
import { clearTrack, loadTrack, saveMeta, savePoint, type TrackMeta } from '../lib/trackStore';
import {
  BATCH_INTERVAL_MS,
  BATCH_MAX_POINTS,
  backoffMs,
  discardSession,
  newSessionId,
  sendBatch,
} from '../services/activitySync';
import type { ActivityType, GeoPoint } from '../types';

export type TrackStatus = 'idle' | 'running' | 'paused' | 'finished';

/** Batas akurasi maksimum saat sudah mendapat lock satelit (di atas ini diabaikan agar rute tidak melompat). */
const MAX_TRACKING_ACCURACY_M = 55;
/** Batas akurasi awal maksimum untuk menerima titik pertama sebelum lock GPS penuh. */
const MAX_INITIAL_ACCURACY_M = 120;
/** Rule 1 — sampel GPS diproses paling sering sekali per detik (1–3 detik). */
const MIN_SAMPLE_INTERVAL_MS = 1000;
/** Rule 1 — perpindahan di bawah ini DAN kecepatan ≈ 0 dianggap jitter (berhenti di lampu merah, dsb.). */
const JITTER_DISTANCE_M = 3;
/** Rule 1 — di bawah kecepatan ini (m/s) pengguna dianggap diam. */
const STILL_SPEED_MPS = 0.5;
/**
 * Bila sensor tidak melaporkan kecepatan, kecepatan dihitung dari perpindahan BERSIH selama jendela ini.
 * Goyangan GPS saat diam saling meniadakan (perpindahan bersih kecil), sedangkan berjalan/berlari tidak.
 */
const SPEED_WINDOW_MS = 6000;
/** Jendela minimal sebelum kecepatan hasil hitung dipercaya; sebelum itu dianggap bergerak. */
const SPEED_WINDOW_MIN_MS = 3000;
/** Kecepatan maksimum lonjakan GPS (m/s) — di atas 35 m/s (126 km/jam) dianggap glitch/multipath spike. */
const MAX_SPIKE_SPEED_MPS = 35;
/** Parameter Kalman process noise (m/detik). */
const KALMAN_Q_MPS = 3.2;
/** Naik/turun minimal (m) agar dihitung sebagai elevation gain — meredam noise altimeter. */
const ELEVATION_STEP_M = 3;
/** Seberapa sering ringkasan sesi disimpan ke IndexedDB saat merekam. */
const META_SAVE_INTERVAL_MS = 5000;

const SIM_CENTER = { lat: -6.2183, lng: 106.8022 }; // Gelora Bung Karno, Jakarta
const SIM_RADIUS_LAT = 0.00145; // ~160m radius loop (~1 km keliling)
const SIM_RADIUS_LNG = 0.00185;
const SIM_ANGULAR_STEP = 0.021; // ~3.35 m/detik (pace ~5:00 min/km)

interface KalmanState {
  lat: number;
  lng: number;
  variance: number;
  timestamp: number;
}

/** Hasil akhir sesi rekam — dibaca saat Finish agar tidak bergantung pada state React yang mungkin basi. */
export interface FinishedTrack {
  points: GeoPoint[];
  distanceKm: number;
  elapsedSec: number;
  elevationGain: number;
  sessionId: string | null;
  startedAt: number | null;
  type: ActivityType;
}

type FlushReason = 'interval' | 'count' | 'pause' | 'online';
export type SyncState = 'idle' | 'syncing' | 'pending';

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Perekam rute berbasis Geolocation API.
 *
 * Alur titik GPS (semua di perangkat, tanpa request jaringan per titik):
 *   sampel (≥1 dtk) → filter akurasi/spike → Kalman → jitter filter (Haversine <3 m & kecepatan ≈ 0)
 *   → buffer memori + IndexedDB (pulih setelah crash/offline) → batch sync tiap 30 dtk atau 15 titik.
 *
 * Titik awal selalu disimpan; titik akhir dipaksa masuk saat Pause/Finish (`flushTail`).
 */
export function useGeoTracker() {
  const [status, setStatusState] = useState<TrackStatus>('idle');
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [distanceKm, setDistanceKm] = useState(0);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [elevationGain, setElevationGain] = useState(0);
  const [accuracyMeters, setAccuracyMeters] = useState<number | null>(null);
  /** Masalah lokasi saat merekam. 'timeout' = sinyal lemah (tracking tetap jalan). */
  const [issue, setIssue] = useState<LocationIssue | null>(null);
  const [simulated, setSimulated] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [unsynced, setUnsynced] = useState(0);
  const [syncState, setSyncState] = useState<SyncState>('idle');

  const statusRef = useRef<TrackStatus>('idle');
  const watchId = useRef<number | null>(null);
  const simTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const simAngle = useRef<number>(0);

  // Sumber kebenaran data sesi (ref) agar callback async tidak membaca state basi.
  const pointsRef = useRef<GeoPoint[]>([]);
  const distanceRef = useRef(0);
  const elevationRef = useRef({ gain: 0, ref: null as number | null });
  const sessionRef = useRef<{ id: string; type: ActivityType; startedAt: number; simulated: boolean } | null>(null);

  const lastPoint = useRef<GeoPoint | null>(null);
  /** Sampel terakhir yang dibuang filter jitter — dipaksa menjadi titik akhir saat Pause/Finish. */
  const tail = useRef<GeoPoint | null>(null);
  const lastSampleTs = useRef<number | null>(null);
  /** Sampel (sudah dihaluskan) selama SPEED_WINDOW_MS terakhir, untuk menaksir kecepatan saat sensor tidak melaporkannya. */
  const recent = useRef<GeoPoint[]>([]);
  const kalman = useRef<KalmanState | null>(null);
  const accumulatedMs = useRef<number>(0);
  const runSegmentStartMs = useRef<number | null>(null);
  const wakeLock = useRef<WakeLockSentinelLike | null>(null);

  const sync = useRef({ acked: 0, inFlight: false, failures: 0, retryAt: 0, disabled: false });
  const flushRef = useRef<(reason: FlushReason) => Promise<void>>(async () => {});

  const setStatus = useCallback((next: TrackStatus) => {
    statusRef.current = next;
    setStatusState(next);
  }, []);

  const currentElapsedSec = useCallback(
    () =>
      Math.floor(
        (accumulatedMs.current + (runSegmentStartMs.current !== null ? Date.now() - runSegmentStartMs.current : 0)) /
          1000,
      ),
    [],
  );

  // ---------------- Persistensi lokal ----------------

  const persistMeta = useCallback(() => {
    const session = sessionRef.current;
    const st = statusRef.current;
    if (!session || (st !== 'running' && st !== 'paused' && st !== 'finished')) return;
    const meta: TrackMeta = {
      sessionId: session.id,
      activityType: session.type,
      startedAt: session.startedAt,
      // 'finished' belum terkirim ke server tetap disimpan sebagai paused → bisa diselesaikan ulang.
      status: st === 'running' ? 'running' : 'paused',
      simulated: session.simulated,
      distanceKm: distanceRef.current,
      elapsedSec: currentElapsedSec(),
      elevationGain: elevationRef.current.gain,
      ackedCount: sync.current.acked,
    };
    void saveMeta(meta);
  }, [currentElapsedSec]);

  // Pulihkan sesi yang terputus (tab ditutup, crash, kehabisan baterai). Dibuka dalam status paused.
  useEffect(() => {
    let cancelled = false;
    void loadTrack().then((stored) => {
      if (cancelled || !stored || statusRef.current !== 'idle') return;
      const { meta, points: saved } = stored;
      pointsRef.current = saved;
      distanceRef.current = meta.distanceKm;
      elevationRef.current = { gain: meta.elevationGain, ref: null };
      accumulatedMs.current = meta.elapsedSec * 1000;
      sync.current = { acked: Math.min(meta.ackedCount, saved.length), inFlight: false, failures: 0, retryAt: 0, disabled: false };
      sessionRef.current = { id: meta.sessionId, type: meta.activityType, startedAt: meta.startedAt, simulated: meta.simulated };
      lastPoint.current = null; // jangan menghitung "lompatan" selama aplikasi mati
      setPoints(saved);
      setDistanceKm(meta.distanceKm);
      setElapsedSec(meta.elapsedSec);
      setElevationGain(meta.elevationGain);
      setAccuracyMeters(saved[saved.length - 1]?.accuracy ?? null);
      setSimulated(meta.simulated);
      setSessionId(meta.sessionId);
      setStartedAt(meta.startedAt);
      setUnsynced(saved.length - sync.current.acked);
      setStatus('paused');
    });
    return () => {
      cancelled = true;
    };
  }, [setStatus]);

  // Reverse geocoding dilarang selama merekam (lihat lib/geocode.ts).
  useEffect(() => {
    setGeocodeLocked(status === 'running' || status === 'paused');
    return () => setGeocodeLocked(false);
  }, [status]);

  // ---------------- Batch sync ----------------

  const flush = useCallback(
    async (reason: FlushReason) => {
      const session = sessionRef.current;
      const s = sync.current;
      if (!session || s.inFlight || s.disabled) return;

      const urgent = reason === 'pause' || reason === 'online';
      if (!urgent && Date.now() < s.retryAt) return; // backoff setelah gagal
      if (!urgent && navigator.onLine === false) return;
      if (reason !== 'pause' && pointsRef.current.length === s.acked) return; // tidak ada yang baru

      s.inFlight = true;
      setSyncState('syncing');
      const res = await sendBatch({
        sessionId: session.id,
        activityType: session.type,
        startedAt: session.startedAt,
        points: pointsRef.current,
        ackedCount: s.acked,
        distanceKm: distanceRef.current,
        elapsedSec: currentElapsedSec(),
        elevationGain: elevationRef.current.gain,
      });
      s.inFlight = false;

      if (res.ok) {
        s.acked = res.ackedCount;
        s.failures = 0;
        s.retryAt = 0;
        persistMeta();
      } else if (res.fatal) {
        s.disabled = true; // server menolak sesi ini; Finish tetap mengirim rute lengkap
      } else {
        s.failures += 1;
        s.retryAt = Date.now() + backoffMs(s.failures);
      }
      const left = pointsRef.current.length - s.acked;
      setUnsynced(left);
      setSyncState(left > 0 && !s.disabled ? 'pending' : 'idle');
    },
    [currentElapsedSec, persistMeta],
  );
  flushRef.current = flush;

  // Batch periodik tiap 30 detik + saat koneksi kembali. (Batch per 15 titik dipicu di commitPoint.)
  useEffect(() => {
    if (status !== 'running') return;
    const timer = setInterval(() => void flushRef.current('interval'), BATCH_INTERVAL_MS);
    const saver = setInterval(persistMeta, META_SAVE_INTERVAL_MS);
    const onOnline = () => void flushRef.current('online');
    const onHide = () => document.visibilityState === 'hidden' && persistMeta();
    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onHide);
    return () => {
      clearInterval(timer);
      clearInterval(saver);
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, [status, persistMeta]);

  // ---------------- Pipeline titik GPS ----------------

  /** Menghaluskan koordinat mentah dengan bobot varians akurasi GPS (1D/2D Kalman filter). */
  const smoothPoint = useCallback((raw: GeoPoint): GeoPoint => {
    const acc = Math.max(3, raw.accuracy ?? 10);
    const state = kalman.current;
    if (!state) {
      kalman.current = { lat: raw.lat, lng: raw.lng, variance: acc * acc, timestamp: raw.timestamp };
      return { ...raw, accuracy: Math.round(acc) };
    }

    const dtSec = Math.max(0.1, (raw.timestamp - state.timestamp) / 1000);
    const predictedVariance = state.variance + dtSec * KALMAN_Q_MPS * KALMAN_Q_MPS;
    const measurementVariance = acc * acc;
    const kGain = predictedVariance / (predictedVariance + measurementVariance);

    const smoothedLat = state.lat + kGain * (raw.lat - state.lat);
    const smoothedLng = state.lng + kGain * (raw.lng - state.lng);
    const updatedVariance = (1 - kGain) * predictedVariance;

    kalman.current = { lat: smoothedLat, lng: smoothedLng, variance: updatedVariance, timestamp: raw.timestamp };

    return {
      ...raw,
      lat: +smoothedLat.toFixed(7),
      lng: +smoothedLng.toFixed(7),
      accuracy: Math.round(Math.sqrt(updatedVariance)),
    };
  }, []);

  /** Elevation gain dari altimeter GPS, dengan ambang agar noise ±beberapa meter tidak menambah tanjakan palsu. */
  const trackElevation = useCallback((p: GeoPoint) => {
    const alt = p.altitude;
    if (alt === null || alt === undefined || !Number.isFinite(alt)) return;
    if (p.altitudeAccuracy != null && p.altitudeAccuracy > 20) return;
    const e = elevationRef.current;
    if (e.ref === null) {
      e.ref = alt;
      return;
    }
    if (alt - e.ref >= ELEVATION_STEP_M) {
      e.gain += alt - e.ref;
      e.ref = alt;
      setElevationGain(e.gain);
    } else if (e.ref - alt >= ELEVATION_STEP_M) {
      e.ref = alt; // turun: geser referensi tanpa mengurangi gain
    }
  }, []);

  /** Masukkan titik ke buffer (memori + IndexedDB). `replaceLast` dipakai saat titik awal diperhalus. */
  const commitPoint = useCallback((p: GeoPoint, replaceLast = false) => {
    const arr = pointsRef.current;
    let index: number;
    if (replaceLast && arr.length > 0) {
      index = arr.length - 1;
      arr[index] = p;
    } else {
      index = arr.length;
      arr.push(p);
    }
    lastPoint.current = p;
    tail.current = null;
    setPoints(arr.slice());
    void savePoint(index, p);

    const pending = arr.length - sync.current.acked;
    setUnsynced(pending);
    // Rule 2: kirim batch saat 15 titik terkumpul (interval 30 detik ditangani timer).
    if (pending >= BATCH_MAX_POINTS) void flushRef.current('count');
  }, []);

  const addPoint = useCallback(
    (rawPoint: GeoPoint, isSimulation = false) => {
      const acc = rawPoint.accuracy ?? (isSimulation ? 4 : 15);
      setAccuracyMeters(Math.round(acc));

      // Rule 1: ambil sampel paling sering 1x per detik (watchPosition bisa lebih rapat).
      if (lastSampleTs.current !== null && rawPoint.timestamp - lastSampleTs.current < MIN_SAMPLE_INTERVAL_MS) return;
      lastSampleTs.current = rawPoint.timestamp;

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
        recent.current = [];
        commitPoint(smoothPoint(rawPoint), true);
        return;
      }

      if (prev && !isSimulation) {
        const rawDistKm = haversineKm(prev, rawPoint);
        const dtSec = Math.max(0.5, (rawPoint.timestamp - prev.timestamp) / 1000);
        const impliedSpeedMps = (rawDistKm * 1000) / dtSec;

        // Tolak lonjakan koordinat tunggal yang mustahil secara fisik (GPS multipath spike)
        if (impliedSpeedMps > MAX_SPIKE_SPEED_MPS) return;

        // Sensor melaporkan diam (0 m/s) dan perpindahan masih di dalam radius akurasi → drift, bukan gerak.
        if (rawPoint.speed != null && rawPoint.speed < 0.35 && rawDistKm * 1000 < acc) return;
      }

      const p = isSimulation ? rawPoint : smoothPoint(rawPoint);

      // Taksir kecepatan dari perpindahan bersih di jendela terakhir (dipakai bila sensor tidak melapor).
      const recentWindow = recent.current;
      recentWindow.push(p);
      while (recentWindow.length > 1 && p.timestamp - recentWindow[0].timestamp > SPEED_WINDOW_MS) recentWindow.shift();
      const spanMs = p.timestamp - recentWindow[0].timestamp;
      const windowSpeed = spanMs >= SPEED_WINDOW_MIN_MS ? (haversineKm(recentWindow[0], p) * 1000) / (spanMs / 1000) : Infinity;

      if (prev) {
        const dMeters = haversineKm(prev, p) * 1000;
        const speed = rawPoint.speed != null && Number.isFinite(rawPoint.speed) ? rawPoint.speed : windowSpeed;

        // Rule 1 — jitter filter: buang bila perpindahan kecil DAN hampir tidak bergerak.
        // Ambang diperlebar mengikuti akurasi GPS agar goyangan sinyal lemah tidak menambah jarak.
        const jitterLimit = isSimulation ? JITTER_DISTANCE_M : Math.max(JITTER_DISTANCE_M, Math.min(12, acc * 0.35));
        if (speed < STILL_SPEED_MPS && dMeters < jitterLimit) {
          tail.current = p; // calon titik akhir bila pengguna berhenti di sini
          return;
        }

        distanceRef.current += dMeters / 1000;
        setDistanceKm(distanceRef.current);
      }

      trackElevation(rawPoint);
      commitPoint(p);
    },
    [commitPoint, smoothPoint, trackElevation],
  );

  /** Pastikan posisi terakhir (yang sempat dibuang sebagai jitter) menjadi titik akhir rute. */
  const flushTail = useCallback(() => {
    const t = tail.current;
    const prev = lastPoint.current;
    tail.current = null;
    if (!t || !prev || t.timestamp === prev.timestamp) return;
    const dMeters = haversineKm(prev, t) * 1000;
    if (dMeters > 100) return; // bukan jitter — abaikan, bukan titik akhir yang valid
    distanceRef.current += dMeters / 1000;
    setDistanceKm(distanceRef.current);
    commitPoint(t);
  }, [commitPoint]);

  // ---------------- Layar tetap menyala selama merekam ----------------

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
              // Arah singgung lingkaran (searah jarum jam dilihat dari atas) agar peta ikut berputar saat demo.
              heading: (((Math.atan2(-SIM_RADIUS_LNG * Math.sin(t), SIM_RADIUS_LAT * Math.cos(t)) * 180) / Math.PI) + 360) % 360,
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
              heading: pos.coords.heading,
              altitude: pos.coords.altitude,
              altitudeAccuracy: pos.coords.altitudeAccuracy,
            },
            false,
          );
        },
        (err) => {
          const next = issueFromError(err);
          setIssue(next);
          // Timeout = sinyal lemah sesaat: watcher tetap jalan. Izin dicabut / GPS mati = jeda.
          if (next !== 'timeout') {
            flushTail();
            stopSources();
            lastPoint.current = null;
            setStatus('paused');
            persistMeta();
            void flushRef.current('pause');
          }
        },
        { enableHighAccuracy: true, maximumAge: 0, timeout: 15000 },
      );
    },
    [addPoint, flushTail, persistMeta, setStatus, stopSources],
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

  // Layar TIDAK boleh mati selama aktivitas berjalan atau dijeda (layar rekam penuh tetap tampil).
  // Wake lock dilepas browser saat tab disembunyikan — ambil lagi saat kembali.
  const tracking = status === 'running' || status === 'paused';
  useEffect(() => {
    if (!tracking) return;
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
  }, [tracking, lockScreen, unlockScreen]);

  // Bersihkan watcher & timer saat pindah halaman.
  useEffect(() => stopSources, [stopSources]);

  const resetSessionData = useCallback(() => {
    lastPoint.current = null;
    tail.current = null;
    lastSampleTs.current = null;
    recent.current = [];
    kalman.current = null;
    simAngle.current = 0;
    accumulatedMs.current = 0;
    runSegmentStartMs.current = null;
    pointsRef.current = [];
    distanceRef.current = 0;
    elevationRef.current = { gain: 0, ref: null };
    sync.current = { acked: 0, inFlight: false, failures: 0, retryAt: 0, disabled: false };
    sessionRef.current = null;
    setPoints([]);
    setDistanceKm(0);
    setElapsedSec(0);
    setElevationGain(0);
    setAccuracyMeters(null);
    setSessionId(null);
    setStartedAt(null);
    setUnsynced(0);
    setSyncState('idle');
    setIssue(null);
  }, []);

  /** Mulai merekam. `firstPoint` = posisi hasil pre-run check (titik awal rute). */
  const start = useCallback(
    (simulate: boolean, firstPoint?: GeoPoint, type: ActivityType = 'run') => {
      resetSessionData();
      const id = newSessionId();
      const now = Date.now();
      sessionRef.current = { id, type, startedAt: now, simulated: simulate };
      setSessionId(id);
      setStartedAt(now);
      setSimulated(simulate);
      runSegmentStartMs.current = now;
      setStatus('running');
      if (firstPoint && !simulate && (firstPoint.accuracy ?? 20) <= MAX_INITIAL_ACCURACY_M) {
        addPoint(firstPoint, false);
      }
      startSources(simulate);
      persistMeta();
    },
    [addPoint, persistMeta, resetSessionData, setStatus, startSources],
  );

  const pause = useCallback(() => {
    flushTail();
    stopSources();
    lastPoint.current = null; // jangan hitung jarak "lompatan" selama jeda
    kalman.current = null;
    recent.current = [];
    setStatus('paused');
    // Rule 2: flush segera saat Pause. Meta disimpan setelah stopwatch berhenti agar durasi akurat.
    queueMicrotask(persistMeta);
    void flushRef.current('pause');
  }, [flushTail, persistMeta, setStatus, stopSources]);

  const resume = useCallback(() => {
    setIssue(null);
    lastSampleTs.current = null;
    recent.current = [];
    startSources(sessionRef.current?.simulated ?? simulated);
    setStatus('running');
  }, [simulated, setStatus, startSources]);

  /**
   * Akhiri rekaman dan kembalikan hasil akhirnya. Rute lengkap dikirim sekali oleh Finish
   * (POST /activities), bukan lewat batch. Gerbang geocoding dibuka di sini (bukan menunggu render)
   * supaya reverse geocoding sekali-saat-Finish bisa langsung berjalan.
   */
  const stop = useCallback((): FinishedTrack => {
    flushTail();
    stopSources();
    setStatus('finished');
    setGeocodeLocked(false);
    queueMicrotask(persistMeta);
    const session = sessionRef.current;
    return {
      points: pointsRef.current.slice(),
      distanceKm: distanceRef.current,
      elapsedSec: currentElapsedSec(),
      elevationGain: elevationRef.current.gain,
      sessionId: session?.id ?? null,
      startedAt: session?.startedAt ?? null,
      type: session?.type ?? 'run',
    };
  }, [currentElapsedSec, flushTail, persistMeta, setStatus, stopSources]);

  /**
   * Bersihkan sesi (buffer lokal ikut dihapus). `discard: true` juga membuang draft di server —
   * dipakai saat user membuang workout, bukan setelah Finish berhasil.
   */
  const reset = useCallback(
    (options?: { discard?: boolean }) => {
      stopSources();
      const id = sessionRef.current?.id;
      if (options?.discard && id) discardSession(id);
      resetSessionData();
      setStatus('idle');
      void clearTrack();
    },
    [resetSessionData, setStatus, stopSources],
  );

  return {
    status,
    points,
    distanceKm,
    elapsedSec,
    elevationGain,
    accuracyMeters,
    issue,
    simulated,
    sessionId,
    startedAt,
    /** Titik yang sudah lolos filter tetapi belum dikonfirmasi server. */
    unsynced,
    syncState,
    start,
    pause,
    resume,
    stop,
    reset,
  };
}
