import { useEffect, useState } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '../../types';

const DEFAULT_CENTER: [number, number] = [-6.2183, 106.8022];

/**
 * Mengatur interaksi peta, tombol Zoom (+/-), tombol Recenter (kembali ke titik GPS),
 * serta mode Auto-Follow cerdas (otomatis berhenti mengikuti jika user menggeser peta manual,
 * dan aktif kembali saat tombol Recenter ditekan).
 */
function InteractiveMapController({
  position,
  path,
}: {
  position: [number, number] | null;
  path: [number, number][];
}) {
  const map = useMap();
  const [followUser, setFollowUser] = useState(true);
  const lat = position?.[0];
  const lng = position?.[1];

  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 120);
    return () => clearTimeout(t);
  }, [map]);

  // Jika pengguna menggeser peta secara manual (drag), matikan auto-follow sementara
  // agar peta tidak mental kembali saat pengguna sedang melihat area sekitar.
  useMapEvents({
    dragstart() {
      setFollowUser(false);
    },
  });

  useEffect(() => {
    if (followUser && lat !== undefined && lng !== undefined) {
      map.panTo([lat, lng], { animate: true, duration: 0.45 });
    }
  }, [map, followUser, lat, lng]);

  function handleRecenter() {
    setFollowUser(true);
    const target = position ?? DEFAULT_CENTER;
    map.setView(target, Math.max(map.getZoom(), 17), { animate: true });
  }

  function handleFitRoute() {
    if (path.length > 1) {
      setFollowUser(false);
      map.fitBounds(path, { padding: [28, 28], maxZoom: 18, animate: true });
    } else {
      handleRecenter();
    }
  }

  return (
    <div
      className="leaflet-top leaflet-right"
      style={{ pointerEvents: 'auto', zIndex: 500 }}
    >
      <div className="m-2.5 flex flex-col gap-1.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            map.zoomIn();
          }}
          title="Perbesar peta (Zoom in)"
          aria-label="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/95 text-base font-bold text-slate-800 shadow-md backdrop-blur transition active:scale-95"
        >
          +
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            map.zoomOut();
          }}
          title="Perkecil peta (Zoom out)"
          aria-label="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/95 text-base font-bold text-slate-800 shadow-md backdrop-blur transition active:scale-95"
        >
          −
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleRecenter();
          }}
          title={
            followUser
              ? 'Mengikuti posisi GPS otomatis'
              : 'Kembali ke posisi saya (Recenter)'
          }
          aria-label="Recenter map to my location"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border shadow-md backdrop-blur transition active:scale-95 ${
            followUser
              ? 'border-cidash-primary bg-cidash-primary text-white'
              : 'border-black/10 bg-white/95 text-slate-700'
          }`}
        >
          <svg
             viewBox="0 0 24 24"
            width="15"
            height="15"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
            <circle cx="12" cy="12" r="7" />
          </svg>
        </button>
        {path.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleFitRoute();
            }}
            title="Lihat seluruh rute"
            aria-label="Fit entire route"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-black/10 bg-white/95 text-[10px] font-bold text-slate-700 shadow-md backdrop-blur transition active:scale-95"
          >
            ALL
          </button>
        )}
      </div>
    </div>
  );
}

interface RouteMapProps {
  points: GeoPoint[];
  /** Posisi user sebelum mulai merekam (hasil izin lokasi). */
  here?: { lat: number; lng: number; accuracy?: number } | null;
  /** Radius akurasi GPS real-time dalam meter. */
  accuracyMeters?: number | null;
}

export default function RouteMap({ points, here, accuracyMeters }: RouteMapProps) {
  const path = points.map((p) => [p.lat, p.lng] as [number, number]);
  const startPos = path.length > 1 ? path[0] : null;
  const latest =
    path.length > 0
      ? path[path.length - 1]
      : here
        ? ([here.lat, here.lng] as [number, number])
        : null;

  const latestAccuracy =
    accuracyMeters ??
    points[points.length - 1]?.accuracy ??
    here?.accuracy ??
    null;

  return (
    <MapContainer
      center={latest ?? DEFAULT_CENTER}
      zoom={17}
      minZoom={3}
      maxZoom={19}
      dragging={true}
      touchZoom={true}
      doubleClickZoom={true}
      scrollWheelZoom={true}
      boxZoom={true}
      keyboard={true}
      zoomControl={false}
      attributionControl
      className="h-full w-full cursor-grab active:cursor-grabbing"
    >
      <TileLayer
        maxZoom={19}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {path.length > 1 && (
        <>
          <Polyline
            positions={path}
            pathOptions={{
              color: '#ffffff',
              weight: 8,
              opacity: 0.85,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <Polyline
            positions={path}
            pathOptions={{
              color: '#ea2845',
              weight: 5,
              opacity: 1,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </>
      )}

      {startPos && (
        <CircleMarker
          center={startPos}
          radius={5}
          pathOptions={{
            color: '#ffffff',
            weight: 2.5,
            fillColor: '#059669',
            fillOpacity: 1,
          }}
        />
      )}

      {latest && (
        <>
          {latestAccuracy !== null && latestAccuracy > 4 && (
            <Circle
              center={latest}
              radius={Math.min(120, Math.max(5, latestAccuracy))}
              pathOptions={{
                color: '#ea2845',
                weight: 1,
                opacity: 0.35,
                fillColor: '#ea2845',
                fillOpacity: 0.12,
              }}
            />
          )}
          <CircleMarker
            center={latest}
            radius={14}
            pathOptions={{ stroke: false, fillColor: '#ea2845', fillOpacity: 0.2 }}
          />
          <CircleMarker
            center={latest}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 3,
              fillColor: '#ea2845',
              fillOpacity: 1,
            }}
          />
        </>
      )}

      <InteractiveMapController position={latest} path={path} />
    </MapContainer>
  );
}
