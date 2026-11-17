import { useCallback, useEffect, useRef, useState } from 'react';
import { angleDelta, watchCompass } from '../lib/compass';
import { bearingDeg, haversineKm } from '../lib/geo';
import type { GeoPoint } from '../types';

/** Di bawah kecepatan ini (m/s) arah GPS tidak dipercaya (sensor heading sering acak saat diam). */
const MOVING_SPEED_MPS = 1;
/** Jarak minimum (m) antar dua titik agar bearing hasil hitung dianggap stabil. */
const MIN_BEARING_DISTANCE_M = 4;
/** Setelah selama ini tanpa gerak, arah beralih dari GPS ke kompas perangkat. */
const STILL_AFTER_MS = 6000;
/** Bobot low-pass: makin kecil makin halus tapi makin lambat. */
const SMOOTHING = 0.4;

/**
 * Arah hadap pengguna (derajat dari utara) untuk memutar peta seperti Google Maps.
 * Bergerak → arah dari GPS (atau bearing dua titik terakhir). Diam → kompas perangkat bila ada.
 * Mengembalikan null sampai ada sumber arah yang valid.
 */
export function useHeading(points: GeoPoint[], active: boolean): number | null {
  const [heading, setHeading] = useState<number | null>(null);
  const smoothed = useRef<number | null>(null);
  const moving = useRef(false);
  const stillTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const push = useCallback((target: number) => {
    const cur = smoothed.current;
    const next = cur === null ? target : (cur + angleDelta(cur, target) * SMOOTHING + 360) % 360;
    smoothed.current = next;
    // Hindari render ulang untuk perubahan < 1° (kompas sangat berisik).
    setHeading((prev) => (prev !== null && Math.abs(angleDelta(prev, next)) < 1 ? prev : next));
  }, []);

  useEffect(() => {
    if (!active) return;
    return watchCompass((deg) => {
      if (!moving.current) push(deg);
    });
  }, [active, push]);

  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  useEffect(() => {
    if (!active || !last) return;
    let target: number | null = null;
    if (typeof last.heading === 'number' && Number.isFinite(last.heading) && (last.speed ?? 0) >= MOVING_SPEED_MPS) {
      target = last.heading;
    } else if (prev && haversineKm(prev, last) * 1000 >= MIN_BEARING_DISTANCE_M) {
      target = bearingDeg(prev, last);
    }
    if (target === null) return;
    moving.current = true;
    push(target);
    if (stillTimer.current) clearTimeout(stillTimer.current);
    stillTimer.current = setTimeout(() => {
      moving.current = false;
    }, STILL_AFTER_MS);
  }, [active, last, prev, push]);

  useEffect(
    () => () => {
      if (stillTimer.current) clearTimeout(stillTimer.current);
    },
    [],
  );

  return heading;
}
