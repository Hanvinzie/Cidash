import { useCallback, useEffect, useState } from 'react';

// Pengaturan perangkat sederhana (disimpan di localStorage, tersinkron antar komponen & tab).
// Tema memakai ThemeContext sendiri.

const EVENT = 'cidash:setting';

export const SETTING_KEYS = {
  notifyBomb: 'cidash_notif_bomb',
  notifyGroup: 'cidash_notif_group',
  /** Bagikan posisi live ke circle selama aktivitas (default mati — opt-in). */
  liveShare: 'cidash_live_share',
  /** Mode simulasi GPS (demo di desktop). */
  simulate: 'cidash_simulate',
  /** Opsi pengembang terbuka (ketuk versi di About 7x). Menyembunyikan alat uji dari pengguna awam. */
  devMode: 'cidash_dev_mode',
} as const;

/** Berapa ketukan pada nomor versi untuk membuka opsi pengembang. */
export const DEV_TAPS_REQUIRED = 7;

function read(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function useBooleanSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => read(key, fallback));

  useEffect(() => {
    const sync = () => setValue(read(key, fallback));
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [key, fallback]);

  const update = useCallback(
    (next: boolean) => {
      try {
        localStorage.setItem(key, next ? '1' : '0');
      } catch {
        /* storage penuh / private mode */
      }
      setValue(next);
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, update];
}
