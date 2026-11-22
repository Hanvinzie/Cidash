import { snapToRoads } from './mapMatch';
import { simplifyRoute } from './simplify';
import type { ActivityType, GeoPoint } from '../types';

/**
 * Rute final yang disimpan & ditampilkan: (opsional) ditempelkan ke jalan, lalu disederhanakan agar mulus.
 * Dipanggil sekali saat Finish. Jarak aktivitas tidak ikut berubah. Selalu mengembalikan rute yang valid:
 * bila snap-to-road mati atau gagal, yang dipakai hanya rute asli yang sudah disederhanakan.
 */
export async function prepareRoute(points: ReadonlyArray<GeoPoint>, type: ActivityType): Promise<GeoPoint[]> {
  const snapped = await snapToRoads(points, type);
  return simplifyRoute(snapped ?? points, 3, 200);
}
