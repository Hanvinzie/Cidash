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
 * Minta satu posisi. Memicu prompt izin native browser bila belum pernah ditanya.
 * Reject dengan LocationError(issue) bila gagal.
 */
export function requestPosition(timeoutMs = 8000): Promise<GeolocationPosition> {
  if (!window.isSecureContext) return Promise.reject(new LocationError('insecure'));
  if (!('geolocation' in navigator)) return Promise.reject(new LocationError('unsupported'));
  return new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, (err) => reject(new LocationError(issueFromError(err))), {
      enableHighAccuracy: true,
      timeout: timeoutMs,
      maximumAge: 15_000,
    }),
  );
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
