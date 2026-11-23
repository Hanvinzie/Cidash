import { useEffect } from 'react';

/**
 * Menjaga layar tetap menyala selama `active` = true (Screen Wake Lock API).
 *
 * Mengapa penting: saat layar redup atau mati, browser seluler menangguhkan JavaScript dan watchPosition, sehingga
 * pelacakan GPS berhenti. Wake lock mencegah layar mati selama sesi berjalan.
 *
 * - Diminta saat `active` menjadi true dan dilepas saat false (Pause/Finish).
 * - Browser otomatis melepas lock ketika tab disembunyikan; diminta ulang saat tab terlihat lagi (`visibilitychange`).
 * - Bila dilepas sistem (mis. mode hemat baterai) dan tab masih terlihat, diminta ulang.
 * - Browser tanpa dukungan atau permintaan ditolak: diabaikan tanpa error (tidak fatal).
 */
export function useScreenWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let cancelled = false;
    let sentinel: WakeLockSentinel | null = null;

    const acquire = async () => {
      if (cancelled || sentinel || document.visibilityState !== 'visible') return;
      try {
        const lock = await navigator.wakeLock.request('screen');
        if (cancelled) {
          void lock.release().catch(() => {});
          return;
        }
        sentinel = lock;
        lock.addEventListener('release', () => {
          if (sentinel === lock) sentinel = null;
          // Dilepas sistem tetapi kita masih butuh dan tab terlihat: minta lagi.
          if (!cancelled && document.visibilityState === 'visible') void acquire();
        });
      } catch {
        /* ditolak (hemat baterai / izin) — tidak fatal */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const lock = sentinel;
      sentinel = null;
      void lock?.release().catch(() => {});
    };
  }, [active]);
}
