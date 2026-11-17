import type { ActivityType, GeoPoint } from '../types';

// ============================================================
// Reverse geocoding (Rule 5).
//
// - TIDAK PERNAH dipanggil saat tracking. `setGeocodeLocked(true)` dipasang tracker selama
//   status running/paused, dan `resolveActivityLabel` menolak bekerja selama terkunci.
// - Hanya SEKALI per aktivitas, saat Finish, memakai titik awal. Hasilnya disimpan di
//   baris Activity (`locationLabel`), jadi riwayat/share tidak perlu memanggil ulang.
// - Koordinat dibulatkan 3 desimal (~110 m) dan hasilnya di-cache lokal, sehingga lari berulang
//   di area yang sama tidak menyentuh server geocoding sama sekali.
// - Gagal / timeout / offline → label cadangan dari waktu & jenis aktivitas. Tidak pernah melempar.
// ============================================================

const ENDPOINT = 'https://nominatim.openstreetmap.org/reverse';
const CACHE_KEY = 'cidash_geocode_v1';
const CACHE_LIMIT = 100;
const TIMEOUT_MS = 3500;
const DECIMALS = 3;

let locked = false;

/** Dipanggil tracker: true selama merekam, false saat idle/finished. */
export function setGeocodeLocked(value: boolean): void {
  locked = value;
}

export const isGeocodeLocked = () => locked;

const roundCoord = (n: number) => n.toFixed(DECIMALS);
const cacheKey = (lat: number, lng: number) => `${roundCoord(lat)},${roundCoord(lng)}`;

function readCache(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

function writeCache(key: string, label: string): void {
  try {
    const cache = readCache();
    delete cache[key]; // pindahkan ke urutan terbaru
    cache[key] = label;
    const keys = Object.keys(cache);
    for (const old of keys.slice(0, Math.max(0, keys.length - CACHE_LIMIT))) delete cache[old];
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage penuh / private mode — cache hanyalah optimasi */
  }
}

/** "Morning Run", "Evening Ride", dst. Dipakai bila nama tempat tidak tersedia. */
export function fallbackLabel(type: ActivityType, timestamp: number): string {
  const hour = new Date(timestamp).getHours();
  const part = hour < 5 ? 'Night' : hour < 11 ? 'Morning' : hour < 15 ? 'Midday' : hour < 18 ? 'Afternoon' : hour < 22 ? 'Evening' : 'Night';
  return `${part} ${type === 'run' ? 'Run' : 'Ride'}`;
}

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  quarter?: string;
  village?: string;
  city_district?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  state?: string;
}

const MAX_LABEL_LENGTH = 40;

/**
 * Ambil label singkat, mis. "Senayan, Jakarta". Provinsi/negara bagian ("Special Capital Region of Jakarta")
 * hanya dipakai bila tidak ada nama kota/kecamatan, karena terlalu panjang untuk judul aktivitas.
 */
function labelFromAddress(addr: NominatimAddress | undefined): string | null {
  if (!addr) return null;
  const local = addr.suburb ?? addr.neighbourhood ?? addr.quarter ?? addr.village ?? addr.city_district;
  const area = addr.city ?? addr.town ?? addr.municipality ?? addr.county;
  const parts = [local, area].filter((v): v is string => Boolean(v));
  const label = (parts.length ? parts.slice(0, 2).join(', ') : addr.state) ?? null;
  if (!label) return null;
  return label.length > MAX_LABEL_LENGTH ? `${label.slice(0, MAX_LABEL_LENGTH - 1).trimEnd()}…` : label;
}

async function fetchLabel(lat: number, lng: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const url = `${ENDPOINT}?format=jsonv2&zoom=16&addressdetails=1&lat=${roundCoord(lat)}&lon=${roundCoord(lng)}`;
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = (await res.json()) as { address?: NominatimAddress };
    return labelFromAddress(data.address);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Label lokasi untuk aktivitas yang baru selesai. Aman dipanggil dari alur Finish:
 * selalu mengembalikan string dan tidak pernah memicu request saat tracker masih aktif.
 */
export async function resolveActivityLabel(
  route: ReadonlyArray<GeoPoint>,
  type: ActivityType,
  startedAt: number,
): Promise<string> {
  const fallback = fallbackLabel(type, startedAt);
  const start = route[0];
  if (locked || !start) return fallback;

  const key = cacheKey(start.lat, start.lng);
  const cached = readCache()[key];
  if (cached) return cached;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) return fallback;

  const label = await fetchLabel(start.lat, start.lng);
  if (!label) return fallback;
  writeCache(key, label);
  return label;
}
