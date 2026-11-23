import { useCallback, useEffect, useRef, useState } from 'react';
import { AttributionControl, LngLatBounds, Map as MapLibreMap, Marker, setWorkerUrl, type GeoJSONSource } from 'maplibre-gl';
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?url';
import 'maplibre-gl/dist/maplibre-gl.css';
import Icon from '../ui/Icon';
import { angleDelta } from '../../lib/compass';
import { splitRoute } from '../../lib/polyline';
import { useHeading } from '../../hooks/useHeading';
import { useTheme } from '../../store/ThemeContext';
import type { GeoPoint } from '../../types';

// Pastikan Web Worker MapLibre v6 ikut di-bundle oleh Vite sehingga peta tetap tampil di produksi (Vercel).
setWorkerUrl(maplibreWorkerUrl);

// Peta vector (MapLibre GL) — tidak memakai raster tile.openstreetmap.org yang melarang pemakaian
// aplikasi berskala besar. Default: OpenFreeMap (gratis, tanpa API key, tanpa batas request).
// Dark mode memakai gaya `fiord` (slate-navy kontras tinggi) agar jalan & label tetap jelas terbaca.
// Ganti ke MapTiler/PMTiles lewat VITE_MAP_STYLE_URL (dan _DARK untuk tema gelap).
const STYLE_LIGHT = import.meta.env.VITE_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/positron';
const STYLE_DARK = import.meta.env.VITE_MAP_STYLE_URL_DARK || 'https://tiles.openfreemap.org/styles/fiord';

const DEFAULT_CENTER: [number, number] = [106.8022, -6.2183]; // [lng, lat] Gelora Bung Karno
const PRIMARY = '#ea2845';
const RECORDING_PITCH = 45;
/** Zoom awal saat merekam: cukup dekat agar jejak rute terlihat detail (±jalan per jalan). */
const RECORDING_ZOOM = 18.5;
const PREVIEW_ZOOM = 16.5;

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
  /** true = peta dikunci utara di atas (kompas ditekan); false = berputar searah gerak (heading-up). */
  const [northUp, setNorthUp] = useState(false);
  /** Jarum kompas diputar langsung lewat DOM agar tidak me-render ulang peta ±60x/detik saat kamera berputar. */
  const needleRef = useRef<HTMLSpanElement>(null);
  /** Setelah pengguna mengubah zoom sendiri, kamera berhenti memaksa zoom otomatis. */
  const userZoomed = useRef(false);

  const heading = useHeading(points, true);
  const lastPoint = points[points.length - 1];
  const lat = lastPoint?.lat ?? here?.lat;
  const lng = lastPoint?.lng ?? here?.lng;

  /** Tambahkan layer rute (dipanggil tiap style selesai dimuat, termasuk setelah ganti tema). */
  const ensureRouteLayers = useCallback((map: MapLibreMap) => {
    if (!map.getSource('route')) map.addSource('route', { type: 'geojson', data: routeRef.current });
    const casing = themeRef.current === 'dark' ? '#f8fafc' : '#ffffff';
    if (!map.getLayer('route-casing')) {
      map.addLayer({
        id: 'route-casing',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': casing, 'line-width': 9, 'line-opacity': 0.92 },
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
      zoom: recording ? RECORDING_ZOOM : PREVIEW_ZOOM,
      maxPitch: 60,
      attributionControl: false,
      // Di halaman yang bisa di-scroll, satu jari menggulir halaman; peta digeser dengan dua jari.
      cooperativeGestures: !recording,
    });
    mapRef.current = map;
    // Hanya mode dev: memudahkan uji otomatis membaca bearing/pitch peta.
    if (import.meta.env.DEV) (container as HTMLElement & { __map?: MapLibreMap }).__map = map;

    // Atribusi (wajib ada) dipasang manual dan DITUTUP secara default; pengguna menekan ikon "i" untuk membukanya.
    map.addControl(new AttributionControl({ compact: true }), 'bottom-right');
    const collapseAttribution = () => {
      const el = container.querySelector('.maplibregl-ctrl-attrib');
      el?.removeAttribute('open');
      el?.classList.remove('maplibregl-compact-show');
    };
    collapseAttribution();
    map.once('load', collapseAttribution);

    map.on('style.load', () => ensureRouteLayers(map));
    map.on('rotate', () => {
      if (needleRef.current) needleRef.current.style.transform = `rotate(${-map.getBearing()}deg)`;
    });
    map.on('zoomstart', (e: { originalEvent?: unknown }) => {
      if (e.originalEvent) userZoomed.current = true;
    });
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
    const bearing =
      recording && !northUp && heading !== null ? current + angleDelta(current, heading) : recording && !northUp ? current : 0;
    map.easeTo({
      center: [lng, lat],
      bearing,
      pitch: recording ? RECORDING_PITCH : 0,
      // Zoom awal cukup dekat; setelah pengguna mengubah zoom sendiri, hormati pilihannya.
      zoom: userZoomed.current ? map.getZoom() : recording ? RECORDING_ZOOM : PREVIEW_ZOOM,
      duration: 800,
      essential: true,
    });
  }, [lat, lng, heading, follow, recording, northUp]);

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
      userZoomed.current = false;
      map.easeTo({ center: [lng, lat], zoom: recording ? RECORDING_ZOOM : PREVIEW_ZOOM, duration: 500 });
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
      {/* Kontrol peta dalam satu kolom di kanan bawah, tepat di atas ikon info atribusi: Kompas, Fokus, Rute lengkap.
          Ketiganya memakai buttonClass yang sama (44×44, bulat) dan jarak antar-tombol yang sama. */}
      <div className="absolute right-3 z-10 flex flex-col gap-2" style={{ bottom: '3.25rem' }}>
        {recording && (
          <button
            type="button"
            onClick={() => {
              setNorthUp((v) => !v);
              setFollow(true);
            }}
            aria-label={northUp ? 'North is up. Tap to rotate with your direction' : 'Map rotates with you. Tap to keep north up'}
            aria-pressed={northUp}
            className={`${buttonClass} ${northUp ? '!bg-cidash-primary !text-cidash-on-primary' : ''}`}
          >
            <span ref={needleRef} className="relative block h-8 w-8" style={{ transition: 'transform 80ms linear' }} aria-hidden>
              <svg viewBox="0 0 32 32" className="h-8 w-8">
                <path d="M16 3 21.5 16h-11Z" fill={northUp ? '#fff' : '#ea2845'} />
                <path d="M16 29 10.5 16h11Z" fill="currentColor" opacity="0.35" />
              </svg>
              <span className="absolute left-1/2 top-[-1px] -translate-x-1/2 text-[8px] font-extrabold leading-none">N</span>
            </span>
          </button>
        )}
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
