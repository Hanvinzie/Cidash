import { useSyncExternalStore } from 'react';
import { registerSW } from 'virtual:pwa-register';

// ============================================================
// Status pembaruan aplikasi (PWA).
//
// Dua sinyal digabung:
//  1. Service worker baru selesai diunduh & menunggu (`needRefresh`) → siap dipasang.
//  2. /version.json di server lebih baru dari versi yang sedang berjalan → info versi untuk ditampilkan,
//     bahkan sebelum service worker selesai diunduh.
// Pemasangan HANYA terjadi saat pengguna menekan Update (Profile → Settings → About).
// ============================================================

export const CURRENT_VERSION = __APP_VERSION__;
export const BUILD_TIME = __BUILD_TIME__;

const CHECK_EVERY_MS = 30 * 60_000;
/** Minimal tampil animasi "Updating…" agar tidak berkedip bila update sangat cepat. */
const MIN_UPDATING_MS = 1800;
const WAIT_FOR_WORKER_MS = 6000;

interface UpdateState {
  needRefresh: boolean;
  latestVersion: string | null;
  checking: boolean;
  updating: boolean;
  lastCheckedAt: number | null;
  /** Pesan singkat bila pemasangan belum bisa dilakukan (mis. versi baru belum selesai diunduh). */
  notice: string | null;
}

let state: UpdateState = {
  needRefresh: false,
  latestVersion: null,
  checking: false,
  updating: false,
  lastCheckedAt: null,
  notice: null,
};
const listeners = new Set<() => void>();
const set = (patch: Partial<UpdateState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let registration: ServiceWorkerRegistration | undefined;
let started = false;

/** Bandingkan "0.10.1" dengan "0.9.0" secara numerik (bukan string). */
export function isNewerVersion(candidate: string, current: string): boolean {
  const a = candidate.split('.').map((n) => parseInt(n, 10) || 0);
  const b = current.split('.').map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0;
  }
  return false;
}

export async function checkForUpdate(): Promise<void> {
  if (state.checking) return;
  set({ checking: true });
  try {
    // Minta browser memeriksa service worker baru (di dev tidak ada registrasi).
    await registration?.update().catch(() => {});
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (res.ok) {
      const data = (await res.json()) as { version?: string };
      if (data.version) set({ latestVersion: data.version });
    }
  } catch {
    /* offline — status lama dipertahankan */
  } finally {
    set({ checking: false, lastCheckedAt: Date.now() });
  }
}

/** Dipanggil sekali di main.tsx. */
export function initAppUpdate(): void {
  if (started) return;
  started = true;

  // Di dev service worker dinonaktifkan (lihat main.tsx); pengecekan versi tetap jalan agar UI bisa dicoba.
  if (!import.meta.env.DEV) {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh: () => set({ needRefresh: true }),
      onRegisteredSW: (_url, reg) => {
        registration = reg;
      },
    });
  }

  void checkForUpdate();
  setInterval(() => void checkForUpdate(), CHECK_EVERY_MS);
  document.addEventListener('visibilitychange', () => {
    const stale = !state.lastCheckedAt || Date.now() - state.lastCheckedAt > 10 * 60_000;
    if (document.visibilityState === 'visible' && stale) void checkForUpdate();
  });
}

/**
 * Pasang versi baru. Versi baru hanya aktif bila service worker baru sudah selesai diunduh dan menunggu
 * (`needRefresh`). Reload tanpa itu hanya memuat ulang bundle lama dari cache, sehingga versi di layar
 * tidak berubah. Maka tanpa service worker baru, kita tidak reload dan menampilkan pesan.
 */
export async function applyUpdate(): Promise<void> {
  if (state.updating) return;
  set({ updating: true, notice: null });
  const minimum = new Promise((r) => setTimeout(r, MIN_UPDATING_MS));
  try {
    await registration?.update().catch(() => {});
    const deadline = Date.now() + WAIT_FOR_WORKER_MS;
    while (!state.needRefresh && registration && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 200));
    }
    await minimum;
    if (updateSW && state.needRefresh) {
      await updateSW(true); // skipWaiting + reload ke bundle baru
      return;
    }
    set({
      updating: false,
      notice: import.meta.env.DEV
        ? 'Pemasangan hanya tersedia di build produksi.'
        : 'Versi baru belum siap diunduh. Coba lagi beberapa saat.',
    });
  } catch {
    set({ updating: false, notice: 'Pemasangan gagal. Coba lagi.' });
  }
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useAppUpdate() {
  const s = useSyncExternalStore(subscribe, () => state);
  const newerVersion = s.latestVersion !== null && isNewerVersion(s.latestVersion, CURRENT_VERSION);
  return {
    ...s,
    currentVersion: CURRENT_VERSION,
    buildTime: BUILD_TIME,
    /** Ada versi lebih baru (SW siap pasang atau version.json lebih tinggi). */
    updateAvailable: s.needRefresh || newerVersion,
    check: checkForUpdate,
    apply: applyUpdate,
  };
}
