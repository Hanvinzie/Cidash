import { Suspense, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Icon from '../ui/Icon';
import { RouteMap } from '../../lazyScreens';
import { caloriesFor } from '../../lib/calories';
import { formatDuration, formatPace, formatPaceSec } from '../../lib/geo';
import type { MapFriend } from '../map/RouteMap';
import type { SyncState } from '../../hooks/useGeoTracker';
import type { ActivityType, GeoPoint } from '../../types';

interface RecordingScreenProps {
  status: 'running' | 'paused';
  type: ActivityType;
  points: GeoPoint[];
  distanceKm: number;
  elapsedSec: number;
  elevationGain: number;
  /** Pace halus saat ini (detik/km) dari waktu aktif; null = belum cukup data, tampilkan rata-rata. */
  paceSecPerKm: number | null;
  accuracyMeters: number | null;
  simulated: boolean;
  syncState: SyncState;
  unsynced: number;
  /** Target misi (km) → tampil progress. */
  goalKm?: number;
  gapMessage?: string | null;
  friends: MapFriend[];
  resuming: boolean;
  onPause: () => void;
  onResume: () => void;
  onFinish: () => void;
}

/**
 * Layar rekam penuh (seperti Strava): peta memenuhi layar dan menutup navigasi sejak Start
 * sampai Finish. Kontrolnya sengaja minim: berjalan → satu tombol Pause; dijeda → Resume atau Finish.
 */
export default function RecordingScreen({
  status,
  type,
  points,
  distanceKm,
  elapsedSec,
  elevationGain,
  paceSecPerKm,
  accuracyMeters,
  simulated,
  syncState,
  unsynced,
  goalKm,
  gapMessage,
  friends,
  resuming,
  onPause,
  onResume,
  onFinish,
}: RecordingScreenProps) {
  // Kunci scroll dokumen di belakang layar penuh.
  useEffect(() => {
    const html = document.documentElement;
    const prev = html.style.overflow;
    html.style.overflow = 'hidden';
    return () => {
      html.style.overflow = prev;
    };
  }, []);

  const running = status === 'running';
  const progress = goalKm ? Math.min(1, distanceKm / goalKm) : 0;
  // Hanya kondisi yang perlu tindakan yang ditampilkan: sinyal GPS lemah atau jeda. Tidak ada label teknis
  // ("Recording", "Simulation", status sync) yang tidak berguna bagi pelari.
  const weakGps = !simulated && (accuracyMeters === null || accuracyMeters > 30);
  void syncState;
  void unsynced;

  const metric = (label: string, value: string | number, unit?: string) => (
    <div className="flex flex-1 flex-col items-center">
      <dd className="text-2xl font-extrabold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-0.5 text-xs font-semibold text-subtle">{unit}</span>}
      </dd>
      <dt className="mt-1 text-[11px] font-medium text-subtle">{label}</dt>
    </div>
  );

  return createPortal(
    <div className="fixed inset-0 z-[900] flex flex-col bg-canvas" role="region" aria-label="Recording activity">
      <div className="relative min-h-0 flex-1">
        <Suspense fallback={<div className="h-full w-full bg-inset" />}>
          <RouteMap points={points} mode="recording" friends={friends} />
        </Suspense>

        {/* Status di atas peta */}
        <div
          className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-start gap-2 px-3"
          style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}
        >
          {(!running || weakGps) && (
            <span
              className="pointer-events-auto flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-bold text-ink shadow-lg"
              aria-live="polite"
            >
              <span className={`h-2 w-2 rounded-full ${running ? 'animate-pulse bg-warning' : 'bg-subtle'}`} />
              {!running ? 'Paused' : accuracyMeters === null ? 'Finding GPS…' : 'Weak GPS signal'}
            </span>
          )}
          {gapMessage && (
            <span className="pointer-events-auto rounded-full bg-surface px-3 py-1.5 text-xs font-semibold shadow-lg">
              {gapMessage}
            </span>
          )}
        </div>
      </div>

      {/* Panel metrik + kontrol */}
      <div className="relative rounded-t-3xl bg-surface px-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] pt-4 shadow-nav">
        {goalKm ? (
          <div className="mb-3" aria-label={`Goal ${goalKm} km`}>
            <div className="mb-1 flex justify-between text-[11px] font-semibold text-subtle">
              <span>Goal</span>
              <span>
                {distanceKm.toFixed(2)} / {goalKm} km
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-inset">
              <div className="h-full rounded-full bg-cidash-primary transition-[width] duration-500" style={{ width: `${progress * 100}%` }} />
            </div>
          </div>
        ) : null}

        <dl className="text-center">
          <dd className="text-6xl font-extrabold tabular-nums leading-none tracking-tight">{distanceKm.toFixed(2)}</dd>
          <dt className="mt-1 text-xs font-semibold text-subtle">kilometers</dt>
        </dl>

        <dl className="mt-4 flex divide-x divide-line rounded-2xl bg-inset py-3">
          {metric('Time', formatDuration(elapsedSec))}
          {metric('Pace', paceSecPerKm !== null ? formatPaceSec(paceSecPerKm) : formatPace(elapsedSec, distanceKm), '/km')}
          {elevationGain > 0
            ? metric('Elevation', Math.round(elevationGain), 'm')
            : metric('Calories', caloriesFor(distanceKm, type, elapsedSec), 'kcal')}
        </dl>

        <div className="mt-4 flex gap-3">
          {running ? (
            <button
              type="button"
              onClick={onPause}
              className="flex h-16 flex-1 items-center justify-center gap-2 rounded-full bg-cidash-primary text-base font-bold text-cidash-on-primary shadow-lg shadow-cidash-primary/30 transition active:scale-[0.97]"
            >
              <Icon name="pause" size={22} /> Pause
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={onResume}
                disabled={resuming}
                className="flex h-16 flex-1 items-center justify-center gap-2 rounded-full bg-cidash-primary text-base font-bold text-cidash-on-primary shadow-lg shadow-cidash-primary/30 transition active:scale-[0.97] disabled:opacity-60"
              >
                <Icon name={resuming ? 'locate' : 'play'} size={20} className={resuming ? 'animate-spin' : ''} />
                {resuming ? 'Finding you…' : 'Resume'}
              </button>
              <button
                type="button"
                onClick={onFinish}
                className="flex h-16 flex-1 items-center justify-center gap-2 rounded-full border-2 border-danger/40 bg-surface text-base font-bold text-danger transition active:scale-[0.97]"
              >
                <Icon name="stop" size={20} /> Finish
              </button>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
