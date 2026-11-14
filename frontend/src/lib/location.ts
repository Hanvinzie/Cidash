// Helper izin & status lokasi (Geolocation API) untuk alur "pre-run check".

export type LocationIssue = 'insecure' | 'unsupported' | 'denied' | 'unavailable' | 'timeout';
export type PermissionStateExt = PermissionState | 'unsupported';

export class LocationError extends Error {
  constructor(public issue: LocationIssue) {
    super(issue);
  }
}

/** Geolocation hanya tersedia di HTTPS / localhost — http://192.168.x.x tidak akan pernah dapat lokasi. */
export const isLocationSupported = () => window.isSecureContext && 'geolocation' in navigator;

export function issueFromError(err: GeolocationPositionError): LocationIssue {
  if (err.code === err.PERMISSION_DENIED) return 'denied';
  if (err.code === err.TIMEOUT) return 'timeout';
  return 'unavailable'; // POSITION_UNAVAILABLE: biasanya GPS/Location Services HP mati
}

/** Status izin tanpa memunculkan prompt. Safari lama tidak punya Permissions API → 'prompt'. */
export async function queryPermission(): Promise<PermissionStateExt> {
  if (!isLocationSupported()) return 'unsupported';
  try {
    const status = await navigator.permissions.query({ name: 'geolocation' });
    return status.state;
  } catch {
    return 'prompt';
  }
}

/** Pantau perubahan izin (mis. user baru mengizinkan di pengaturan). Mengembalikan fungsi unsubscribe. */
export function watchPermission(cb: (state: PermissionState) => void): () => void {
  let status: PermissionStatus | null = null;
  let cancelled = false;
  const onChange = () => status && cb(status.state);
  navigator.permissions
    ?.query({ name: 'geolocation' })
    .then((s) => {
      if (cancelled) return;
      status = s;
      s.addEventListener('change', onChange);
    })
    .catch(() => {});
  return () => {
    cancelled = true;
    status?.removeEventListener('change', onChange);
  };
}

/**
 * Meminta posisi GPS segar dengan akurasi terbaik.
 * Menggunakan watchPosition singkat (warm-up maks ~2.5 detik setelah fix pertama)
 * bila fix awal masih kasar (> 25m, mis. estimasi menara seluler/Wi-Fi),
 * lalu mengembalikan sampel paling akurat.
 */
export function requestPosition(timeoutMs = 10_000, targetAccuracyM = 25): Promise<GeolocationPosition> {
  if (!window.isSecureContext) return Promise.reject(new LocationError('insecure'));
  if (!('geolocation' in navigator)) return Promise.reject(new LocationError('unsupported'));

  return new Promise((resolve, reject) => {
    let bestPos: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let settleTimer: ReturnType<typeof setTimeout> | null = null;
    let settled = false;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (settleTimer !== null) clearTimeout(settleTimer);
      clearTimeout(hardTimeout);
    };

    const finishWith = (pos: GeolocationPosition) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(pos);
    };

    const failWith = (err: LocationError) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (bestPos) resolve(bestPos);
      else reject(err);
    };

    const hardTimeout = setTimeout(() => {
      failWith(new LocationError('timeout'));
    }, timeoutMs);

    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPos || pos.coords.accuracy <= bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // Jika akurasi sudah tajam (<= 25m), langsung kembalikan tanpa menunggu.
        if (pos.coords.accuracy <= targetAccuracyM) {
          finishWith(pos);
          return;
        }
        // Jika fix pertama masih agak kasar, beri waktu singkat (1.8 detik) untuk lock satelit GPS yang lebih tajam.
        if (settleTimer === null) {
          settleTimer = setTimeout(() => {
            if (bestPos) finishWith(bestPos);
          }, 1800);
        }
      },
      (err) => {
        failWith(new LocationError(issueFromError(err)));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    );
  });
}

export const platform = (): 'ios' | 'android' | 'other' => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && navigator.maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  return 'other';
};

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;
