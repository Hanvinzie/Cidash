import { useCallback, useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import Icon from '../ui/Icon';
import { angleDelta } from '../../lib/compass';
import { splitRoute } from '../../lib/polyline';
import { useHeading } from '../../hooks/useHeading';
import { useTheme } from '../../store/ThemeContext';
import type { GeoPoint } from '../../types';

// Peta vector (MapLibre GL) — tidak memakai raster tile.openstreetmap.org yang melarang pemakaian
// aplikasi berskala besar. Default: OpenFreeMap (gratis, tanpa API key, tanpa batas request).
// Ganti ke MapTiler/PMTiles lewat VITE_MAP_STYLE_URL (dan _DARK untuk tema gelap).
const STYLE_LIGHT = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = import.meta.env.VITE_MAP_STYLE_URL_DARK || 'https://tiles.openfreemap.org/styles/dark';

const DEFAULT_CENTER: [number, number] = [106.8022, -6.2183]; // [lng, lat] Gelora Bung Karno
const PRIMARY = '#ea2845';
const RECORDING_PITCH = 45;

export interface MapFriend {
  id: string;
  name: string;
  lat: number;
  lng: number;
  heading?: number | null;
}

interface RouteMapProps {
  points: GeoPoint[];
  /** Posisi user sebelum mulai merekam (hasil izin lokasi). */
  here?: { lat: number; lng: number; accuracy?: number } | null;
  /**
   * `preview`: peta utara-di-atas untuk layar siap-mulai.
   * `recording`: layar penuh, kamera mengikuti dan berputar searah arah gerak (heading-up), dimiringkan 45°.
   */
  mode?: 'preview' | 'recording';
  /** Anggota circle yang sedang berbagi lokasi live. */
  friends?: MapFriend[];
  className?: string;
}

interface LineFeature {
  type: 'Feature';
  properties: Record<string, never>;
  /** MultiLineString: jeda yang terputus (gap) menjadi garis terpisah, tidak disambung lurus. */
  geometry: { type: 'MultiLineString'; coordinates: [number, number][][] };
}

const EMPTY_LINE: LineFeature = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'MultiLineString', coordinates: [] },
};

function routeFeature(points: GeoPoint[]): LineFeature {
  return {
    ...EMPTY_LINE,
    geometry: { type: 'MultiLineString', coordinates: splitRoute(points).map((seg) => seg.map((p) => [p.lng, p.lat] as [number, number])) },
  };
}

/** Penanda posisi pengguna: panah arah + denyut. Tanpa arah → titik biasa. */
function createMeElement(): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'cidash-me no-heading';
  el.innerHTML = `
    <span class="cidash-me__pulse"></span>
    <span class="cidash-me__dot"></span>
    <svg class="cidash-me__arrow" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.5 19.5 21 12 16.8 4.5 21Z" fill="${PRIMARY}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
    </svg>`;
  return el;
}

function createFriendElement(name: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = 'cidash-friend';
  el.innerHTML = `<span class="cidash-friend__bubble"></span><span class="cidash-friend__name"></span>`;
  (el.querySelector('.cidash-friend__bubble') as HTMLElement).textContent = name.charAt(0).toUpperCase();
  (el.querySelector('.cidash-friend__name') as HTMLElement).textContent = name;
  return el;
}

export default function RouteMap({ points, here, mode = 'preview', friends, className = '' }: RouteMapProps) {
  const { resolved } = useTheme();
  const recording = mode === 'recording';
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const meRef = useRef<{ marker: Marker; el: HTMLDivElement } | null>(null);
  const startRef = useRef<Marker | null>(null);
  const friendMarkers = useRef(new Map<string, { marker: Marker; el: HTMLDivElement }>());
  const routeRef = useRef<LineFeature>(EMPTY_LINE);
  const themeRef = useRef(resolved);
  themeRef.current = resolved;
  const [follow, setFollow] = useState(true);

  const heading = useHeading(points, true);
  const lastPoint = points[points.length - 1];
  const lat = lastPoint?.lat ?? here?.lat;
  const lng = lastPoint?.lng ?? here?.lng;

  /** Tambahkan layer rute (dipanggil tiap style selesai dimuat, termasuk setelah ganti tema). */
  const ensureRouteLayers = useCallback((map: MapLibreMap) => {
    if (!map.getSource('route')) map.addSource('route', { type: 'geojson', data: routeRef.current });
    const casing = themeRef.current === 'dark' ? '#0b0f17' : '#ffffff';
    if (!map.getLayer('route-casing')) {
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': casing, 'line-width': 9, 'line-opacity': 0.9 },
      });
    }
    if (!map.getLayer('route-line')) {
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': PRIMARY, 'line-width': 5 },
      });
    }
  }, []);

  // ---- Inisialisasi peta (sekali) ----
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new MapLibreMap({
      container,
      style: themeRef.current === 'dark' ? STYLE_DARK : STYLE_LIGHT,
      center: lng !== undefined && lat !== undefined ? [lng, lat] : DEFAULT_CENTER,
      zoom: 16.5,
      maxPitch: 60,
      attributionControl: { compact: true },
      // Di halaman yang bisa di-scroll, satu jari menggulir halaman; peta digeser dengan dua jari.
      cooperativeGestures: !recording,
    });
    mapRef.current = map;
    // Hanya mode dev: memudahkan uji otomatis membaca bearing/pitch peta.
    if (import.meta.env.DEV) (container as HTMLElement & { __map?: MapLibreMap }).__map = map;

    map.on('style.load', () => ensureRouteLayers(map));
    // Pengguna menggeser/memutar peta sendiri → berhenti mengikuti sampai tombol recenter ditekan.
    const stopFollow = (e: { originalEvent?: unknown }) => e.originalEvent && setFollow(false);
    map.on('dragstart', stopFollow);
    map.on('rotatestart', stopFollow);

    const resize = new ResizeObserver(() => map.resize());
    resize.observe(container);

    const friendsMap = friendMarkers.current;
    return () => {
      resize.disconnect();
      meRef.current?.marker.remove();
      startRef.current?.remove();
      friendsMap.forEach((f) => f.marker.remove());
      friendsMap.clear();
      meRef.current = null;
      startRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map dibuat sekali; posisi awal hanya untuk center awal
  }, [ensureRouteLayers]);

  // ---- Ganti style saat tema berubah ----
  const firstTheme = useRef(true);
  useEffect(() => {
    if (firstTheme.current) {
      firstTheme.current = false;
      return;
    }
    mapRef.current?.setStyle(resolved === 'dark' ? STYLE_DARK : STYLE_LIGHT);
  }, [resolved]);

  // ---- Rute ----
  useEffect(() => {
    routeRef.current = routeFeature(points);
    const src = mapRef.current?.getSource('route') as GeoJSONSource | undefined;
    src?.setData(routeRef.current);
  }, [points]);

  // ---- Titik start ----
  const first = points[0];
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (points.length < 2 || !first) {
      startRef.current?.remove();
      startRef.current = null;
      return;
    }
    if (!startRef.current) {
      const el = document.createElement('div');
      el.className = 'cidash-start';
      startRef.current = new Marker({ element: el }).setLngLat([first.lng, first.lat]).addTo(map);
    } else {
      startRef.current.setLngLat([first.lng, first.lat]);
    }
  }, [points.length, first]);

  // ---- Penanda posisi + arah ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || lat === undefined || lng === undefined) return;
    if (!meRef.current) {
      const el = createMeElement();
      const marker = new Marker({ element: el, rotationAlignment: 'map', pitchAlignment: 'map' })
        .setLngLat([lng, lat])
        .addTo(map);
      meRef.current = { marker, el };
    } else {
      meRef.current.marker.setLngLat([lng, lat]);
    }
    const { marker, el } = meRef.current;
    el.classList.toggle('no-heading', heading === null);
    if (heading !== null) marker.setRotation(heading);
  }, [lat, lng, heading]);

  // ---- Kamera: ikuti posisi; saat merekam berputar searah arah gerak (heading-up) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !follow || lat === undefined || lng === undefined) return;
    const current = map.getBearing();
    // Putar lewat jalur terpendek (359° → 1° tidak berputar balik 358°).
    const bearing = recording && heading !== null ? current + angleDelta(current, heading) : recording ? current : 0;
    map.easeTo({
      center: [lng, lat],
      bearing,
      pitch: recording ? RECORDING_PITCH : 0,
      zoom: Math.max(map.getZoom(), recording ? 17 : 16),
      duration: 800,
      essential: true,
    });
  }, [lat, lng, heading, follow, recording]);

  // ---- Teman circle yang berbagi lokasi live (Supabase Realtime Broadcast) ----
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const live = friendMarkers.current;
    const seen = new Set<string>();
    for (const f of friends ?? []) {
      seen.add(f.id);
      const existing = live.get(f.id);
      if (existing) {
        existing.marker.setLngLat([f.lng, f.lat]);
      } else {
        const el = createFriendElement(f.name);
        live.set(f.id, { el, marker: new Marker({ element: el }).setLngLat([f.lng, f.lat]).addTo(map) });
      }
    }
    for (const [id, f] of live) {
      if (!seen.has(id)) {
        f.marker.remove();
        live.delete(id);
      }
    }
  }, [friends]);

  function recenter() {
    setFollow(true);
    const map = mapRef.current;
    if (map && lat !== undefined && lng !== undefined) {
      map.easeTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17), duration: 500 });
    }
  }

  function fitRoute() {
    const map = mapRef.current;
    if (!map || points.length < 2) return;
    setFollow(false);
    const bounds = points.reduce((b, p) => b.extend([p.lng, p.lat]), new LngLatBounds());
    map.fitBounds(bounds, { padding: 56, maxZoom: 18, pitch: 0, bearing: 0, duration: 600 });
  }

  const buttonClass =
    'flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-lg ring-1 ring-line/60 transition active:scale-90';

  return (
    <div className={`relative h-full w-full ${className}`}>
      {/* Inline style: CSS MapLibre (.maplibregl-map {position: relative}) dimuat belakangan dan menimpa kelas Tailwind → tinggi 0. */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0 }} />
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-2" style={recording ? { top: 'calc(env(safe-area-inset-top) + 0.75rem)' } : undefined}>
        <button
          type="button"
          onClick={recenter}
          aria-label={follow ? 'Following your location' : 'Recenter on my location'}
          className={`${buttonClass} ${follow ? '!bg-cidash-primary !text-cidash-on-primary' : ''}`}
        >
          <Icon name="locate" size={20} />
        </button>
        {points.length > 1 && (
          <button type="button" onClick={fitRoute} aria-label="Show whole route" className={buttonClass}>
            <Icon name="map" size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
