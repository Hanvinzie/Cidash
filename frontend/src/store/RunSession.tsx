import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';
import { useGeoTracker } from '../hooks/useGeoTracker';
import { useGroupRun } from '../hooks/useGroupRun';
import { useApp } from './AppContext';

// ============================================================
// Sesi rekam aktivitas hidup di level layout (bukan di halaman Activity),
// sehingga lari tetap terekam saat user pindah tab — seperti aplikasi native.
// ============================================================

type RunSession = {
  tracker: ReturnType<typeof useGeoTracker>;
  group: ReturnType<typeof useGroupRun>;
};

const RunSessionContext = createContext<RunSession | null>(null);
/** Konteks terpisah bernilai boolean → komponen kecil (titik di nav) tidak re-render tiap detik. */
const RecordingContext = createContext(false);

export function RunSessionProvider({ children }: { children: ReactNode }) {
  const { user } = useApp();
  const tracker = useGeoTracker();
  const group = useGroupRun({
    me: { id: user.id, username: user.username },
    reporting: tracker.status === 'running', // hanya terkirim bila sedang di dalam room
    distanceKm: tracker.distanceKm,
    lastPoint: tracker.points[tracker.points.length - 1],
  });
  const recording = tracker.status === 'running' || tracker.status === 'paused';

  return (
    <RunSessionContext.Provider value={{ tracker, group }}>
      <RecordingContext.Provider value={recording}>{children}</RecordingContext.Provider>
    </RunSessionContext.Provider>
  );
}

export function useRunSession(): RunSession {
  const ctx = useContext(RunSessionContext);
  if (!ctx) throw new Error('useRunSession must be used inside <RunSessionProvider>');
  return ctx;
}

export const useIsRecording = () => useContext(RecordingContext);
