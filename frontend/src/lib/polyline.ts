/**
 * Google Encoded Polyline Algorithm (presisi 5 ≈ 1,1 m).
 * Satu aktivitas disimpan sebagai SATU string polyline (~3 KB untuk lari 5 km),
 * bukan satu baris per titik koordinat dan bukan array GeoJSON.
 *
 * Referensi: https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 * Salinan backend: backend/src/common/utils/polyline.ts (kedua file harus tetap sama).
 */

/** Pasangan [lat, lng] dalam derajat. */
export type LatLng = [number, number];

const PRECISION = 1e5;

function encodeSigned(value: number, out: string[]): void {
  let v = value < 0 ? ~(value << 1) : value << 1;
  while (v >= 0x20) {
    out.push(String.fromCharCode((0x20 | (v & 0x1f)) + 63));
    v >>= 5;
  }
  out.push(String.fromCharCode(v + 63));
}

export function encodePolyline(points: ReadonlyArray<LatLng>): string {
  const out: string[] = [];
  let prevLat = 0;
  let prevLng = 0;
  for (const [lat, lng] of points) {
    const latE5 = Math.round(lat * PRECISION);
    const lngE5 = Math.round(lng * PRECISION);
    encodeSigned(latE5 - prevLat, out);
    encodeSigned(lngE5 - prevLng, out);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out.join('');
}

/**
 * Mendekode polyline. Melempar Error bila string terpotong / berisi karakter di luar
 * rentang polyline, sehingga input rusak dari client tidak menghasilkan koordinat acak.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  const readValue = (): number => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) {
        throw new Error('Encoded polyline terpotong');
      }
      byte = encoded.charCodeAt(index++) - 63;
      if (byte < 0 || byte > 63) {
        throw new Error('Karakter encoded polyline tidak valid');
      }
      result |= (byte & 0x1f) << shift;
      shift += 5;
      if (shift > 30) {
        throw new Error('Nilai encoded polyline terlalu besar');
      }
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };

  while (index < encoded.length) {
    lat += readValue();
    lng += readValue();
    points.push([lat / PRECISION, lng / PRECISION]);
  }
  return points;
}

export function isValidLatLng([lat, lng]: LatLng): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Rute dengan jeda terputus disimpan sebagai beberapa segmen yang dipisah ';' di dalam SATU string.
 * ';' (ASCII 59) di luar rentang karakter polyline (63–126), jadi tidak ambigu dengan data koordinat.
 */
export const SEGMENT_SEPARATOR = ';';

export function encodeSegments(segments: ReadonlyArray<ReadonlyArray<LatLng>>): string {
  return segments
    .filter((s) => s.length > 0)
    .map((s) => encodePolyline(s))
    .join(SEGMENT_SEPARATOR);
}

export function decodeSegments(encoded: string): LatLng[][] {
  return encoded
    .split(SEGMENT_SEPARATOR)
    .filter((part) => part.length > 0)
    .map((part) => decodePolyline(part));
}

interface RoutePoint {
  lat: number;
  lng: number;
  /** Titik ini memulai segmen baru (rute terputus dari titik sebelumnya). */
  gap?: boolean;
}

/** Titik GPS → polyline DATAR (tanpa pemisah segmen). Dipakai batch sync, yang hanya cadangan draft. */
export function encodeGeoPoints(points: ReadonlyArray<RoutePoint>): string {
  return encodePolyline(points.map((p) => [p.lat, p.lng] as LatLng));
}

/** Pecah titik menjadi segmen pada setiap titik bertanda `gap`. */
export function splitRoute<T extends RoutePoint>(points: ReadonlyArray<T>): T[][] {
  const segments: T[][] = [];
  for (const p of points) {
    if (p.gap || segments.length === 0) segments.push([p]);
    else segments[segments.length - 1].push(p);
  }
  return segments;
}

/** Titik GPS → polyline final dengan segmen terputus (dikirim saat Finish). */
export function encodeRoute(points: ReadonlyArray<RoutePoint>): string {
  return encodeSegments(splitRoute(points).map((seg) => seg.map((p) => [p.lat, p.lng] as LatLng)));
}
