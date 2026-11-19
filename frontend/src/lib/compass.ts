// ============================================================
// Kompas perangkat (DeviceOrientation) — dipakai peta untuk menunjukkan arah hadap saat pengguna
// berdiri diam. Saat bergerak, arah diambil dari GPS (lebih akurat dan tidak terpengaruh
// cara memegang HP).
// ============================================================

type OrientationEvt = DeviceOrientationEvent & { webkitCompassHeading?: number };
type OrientationCtor = typeof DeviceOrientationEvent & { requestPermission?: () => Promise<'granted' | 'denied'> };

/**
 * iOS 13+ mewajibkan izin eksplisit dari gestur pengguna. Panggil dari handler tap (mis. tombol Start)
 * SEBELUM `await` apa pun. Di Android/desktop selalu `true`.
 */
export async function requestCompassPermission(): Promise<boolean> {
  if (typeof DeviceOrientationEvent === 'undefined') return false;
  const ctor = DeviceOrientationEvent as OrientationCtor;
  if (typeof ctor.requestPermission !== 'function') return true;
  try {
    return (await ctor.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

/** Selisih sudut terpendek (derajat, -180..180) dari `from` ke `to`. */
export function angleDelta(from: number, to: number): number {
  return ((((to - from) % 360) + 540) % 360) - 180;
}

/** Berlangganan arah kompas (0–360, searah jarum jam dari utara sejati). Mengembalikan fungsi berhenti. */
export function watchCompass(onHeading: (deg: number) => void): () => void {
  if (typeof window === 'undefined' || typeof DeviceOrientationEvent === 'undefined') return () => {};

  const handler = (e: Event) => {
    const evt = e as OrientationEvt;
    // iOS memberi heading magnetik langsung. Android: alpha pada event "absolute" = berlawanan arah jarum jam dari utara.
    if (typeof evt.webkitCompassHeading === 'number') return onHeading(evt.webkitCompassHeading);
    if (evt.absolute && typeof evt.alpha === 'number') return onHeading((360 - evt.alpha) % 360);
  };

  // Android Chrome memancarkan data absolut lewat event khusus; event biasa berupa orientasi relatif.
  window.addEventListener('deviceorientationabsolute', handler as EventListener, true);
  window.addEventListener('deviceorientation', handler as EventListener, true);
  return () => {
    window.removeEventListener('deviceorientationabsolute', handler as EventListener, true);
    window.removeEventListener('deviceorientation', handler as EventListener, true);
  };
}
