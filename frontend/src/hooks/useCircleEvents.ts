import { useCallback, useEffect, useRef, useState } from 'react';
import { acquireCircleChannel } from '../services/circleRealtime';
import { isRealtimeConfigured } from '../services/supabase';

// ============================================================
// Sinyal "circle berubah" lewat channel Realtime bersama (services/circleRealtime.ts).
//
// Event TIDAK membawa data: penerima hanya memicu refresh lewat REST. Karena itu aman walau dipalsukan
// (paling buruk satu refresh ekstra, dan refresh sudah dibatasi jeda minimum).
// ============================================================

/** Siaran keluar paling cepat sekali per detik per circle. */
const SEND_GAP_MS = 1000;
/** Beri channel waktu tersambung & mengirim antrean sebelum referensi sementara dilepas. */
const NOTIFY_HOLD_MS = 4000;

interface Options {
  circleId?: string | null;
  enabled: boolean;
  /** Dipanggil saat anggota lain memberi sinyal, dan saat koneksi pulih (untuk mengejar yang terlewat). */
  onSignal: () => void;
  /** Dipanggil saat status koneksi Realtime berubah. */
  onConnectionChange?: (connected: boolean) => void;
}

export function useCircleEvents({ circleId, enabled, onSignal, onConnectionChange }: Options) {
  const onSignalRef = useRef(onSignal);
  onSignalRef.current = onSignal;
  const onConnRef = useRef(onConnectionChange);
  onConnRef.current = onConnectionChange;
  const [connected, setConnected] = useState(false);
  const lastSent = useRef(new Map<string, number>());

  useEffect(() => {
    if (!isRealtimeConfigured || !enabled || !circleId) {
      setConnected(false);
      onConnRef.current?.(false);
      return;
    }
    const handle = acquireCircleChannel(circleId);
    if (!handle) return;
    const update = (c: boolean) => {
      setConnected(c);
      onConnRef.current?.(c);
    };
    update(handle.connected);
    const offSignal = handle.on('circle_changed', () => onSignalRef.current());
    // Tersambung (pertama atau kembali setelah putus): sinkronkan, mungkin ada perubahan yang terlewat.
    const offStatus = handle.onStatus((c) => {
      update(c);
      if (c) onSignalRef.current();
    });
    return () => {
      offSignal();
      offStatus();
      handle.release();
      update(false);
    };
  }, [circleId, enabled]);

  /** Beri tahu anggota lain bahwa circle ini berubah. Antre sampai channel siap (mis. baru bergabung). */
  const notify = useCallback((id: string) => {
    if (!isRealtimeConfigured) return;
    const now = Date.now();
    if (now - (lastSent.current.get(id) ?? 0) < SEND_GAP_MS) return;
    lastSent.current.set(id, now);
    const handle = acquireCircleChannel(id);
    if (!handle) return;
    handle.send('circle_changed', { ts: now });
    setTimeout(() => handle.release(), NOTIFY_HOLD_MS);
  }, []);

  return { notify, connected };
}
