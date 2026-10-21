import { useEffect } from 'react';
import { ALL_CHUNKS } from '../../lazyScreens';
import { whenIdle } from '../../lib/lazy';

type BootWindow = Window & { __hideBoot?: (() => void) | null };

/**
 * Dirender bersama halaman pertama (di dalam Suspense yang sama), jadi efeknya baru jalan
 * setelah halaman benar-benar siap: tutup boot splash, lalu preload halaman lain saat idle.
 */
export default function HideBoot() {
  useEffect(() => {
    const w = window as BootWindow;
    if (!w.__hideBoot) return;
    w.__hideBoot();
    whenIdle(() => ALL_CHUNKS.forEach((c) => void c.preload()));
  }, []);
  return null;
}
