import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_WEIGHT_KG, sanitizeWeightKg } from './geo';

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
  /** Berat badan (kg) untuk menghitung kalori. Kosong = pakai bawaan. */
  weightKg: 'cidash_weight_kg',
} as const;

/** Berapa ketukan pada nomor versi untuk membuka opsi pengembang. */
export const DEV_TAPS_REQUIRED = 7;

/** Baca pengaturan di luar komponen React (mis. saat memutuskan perlu menyimpan notifikasi atau tidak). */
export function readBooleanSetting(key: string, fallback: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function useBooleanSetting(key: string, fallback: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(() => readBooleanSetting(key, fallback));

  useEffect(() => {
    const sync = () => setValue(readBooleanSetting(key, fallback));
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

/** Berat badan pengguna (kg) untuk kalori; bawaan bila belum diisi atau nilainya tidak masuk akal. */
export function readWeightKg(): number {
  try {
    const raw = localStorage.getItem(SETTING_KEYS.weightKg);
    return raw === null ? DEFAULT_WEIGHT_KG : sanitizeWeightKg(raw);
  } catch {
    return DEFAULT_WEIGHT_KG;
  }
}

/** Simpan berat badan; nilai kosong/tidak valid menghapus pengaturan (kembali ke bawaan). */
export function saveWeightKg(value: string): void {
  try {
    const n = Number(value.replace(',', '.'));
    if (value.trim() === '' || sanitizeWeightKg(n) !== n) localStorage.removeItem(SETTING_KEYS.weightKg);
    else localStorage.setItem(SETTING_KEYS.weightKg, String(Math.round(n * 10) / 10));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    /* storage penuh / private mode */
  }
}
