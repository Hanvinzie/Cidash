import { useCallback, useEffect, useRef } from 'react';

/** Jeda minimum antar dua refresh, supaya sinyal beruntun (visibility, online, realtime) digabung jadi satu permintaan. */
const MIN_GAP_MS = 3000;
const MAX_BACKOFF_MS = 5 * 60_000;
const MAX_FAILURES = 5;

interface Options {
  enabled: boolean;
  intervalMs: number;
  /** Mengembalikan true bila sukses. false/throw → interval membesar eksponensial (maks 5 menit). */
  task: () => Promise<boolean>;
}

/**
 * Polling satu timer. Berjalan hanya saat tab terlihat dan perangkat online, tidak pernah menumpuk permintaan,
 * langsung refresh saat tab kembali terlihat atau koneksi pulih, dan melambat bila server gagal.
 * `refreshNow()` meminta refresh secepatnya (tetap menghormati MIN_GAP_MS dan tidak menumpuk).
 */
export function useAutoRefresh({ enabled, intervalMs, task }: Options) {
  const taskRef = useRef(task);
  taskRef.current = task;
  const requestRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let inFlight = false;
    let failures = 0;
    let lastRun = Date.now(); // data baru saja dimuat oleh hydrate
    let timer: ReturnType<typeof setTimeout> | null = null;

    const visible = () => document.visibilityState === 'visible';
    const clear = () => {
      if (timer) clearTimeout(timer);
      timer = null;
    };
    const scheduleIn = (ms: number) => {
      clear();
      if (stopped || inFlight || !visible()) return;
      timer = setTimeout(() => void run(), ms);
    };
    const scheduleNext = () => scheduleIn(Math.min(intervalMs * 2 ** failures, MAX_BACKOFF_MS));

    async function run() {
      clear();
      if (stopped || inFlight || !visible() || !navigator.onLine) return; // 'online' akan memicu lagi
      inFlight = true;
      lastRun = Date.now();
      let ok = false;
      try {
        ok = await taskRef.current();
      } catch {
        ok = false;
      }
      inFlight = false;
      failures = ok ? 0 : Math.min(failures + 1, MAX_FAILURES);
      scheduleNext();
    }

    const request = () => scheduleIn(Math.max(0, MIN_GAP_MS - (Date.now() - lastRun)));
    requestRef.current = request;

    const onVisibility = () => (visible() ? request() : clear());
    const onOnline = () => {
      failures = 0;
      request();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline);
    scheduleNext();

    return () => {
      stopped = true;
      clear();
      requestRef.current = () => {};
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
    };
  }, [enabled, intervalMs]);

  return { refreshNow: useCallback(() => requestRef.current(), []) };
}
