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

/** Bantu: titik GPS → polyline (membuang timestamp/akurasi). */
export function encodeGeoPoints(points: ReadonlyArray<{ lat: number; lng: number }>): string {
  return encodePolyline(points.map((p) => [p.lat, p.lng] as LatLng));
}
