import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '../../types';

const DEFAULT_CENTER: [number, number] = [-6.2183, 106.8022];

/** Menggeser peta mengikuti posisi terakhir. */
function FollowLatest({ position }: { position: [number, number] | null }) {
  const map = useMap();
  const lat = position?.[0];
  const lng = position?.[1];
  useEffect(() => {
    if (lat !== undefined && lng !== undefined) map.panTo([lat, lng], { animate: true });
  }, [map, lat, lng]);
  return null;
}

interface RouteMapProps {
  points: GeoPoint[];
  /** Posisi user sebelum mulai merekam (hasil izin lokasi). */
  here?: { lat: number; lng: number } | null;
}

export default function RouteMap({ points, here }: RouteMapProps) {
  const path = points.map((p) => [p.lat, p.lng] as [number, number]);
  const latest = path.length > 0 ? path[path.length - 1] : here ? ([here.lat, here.lng] as [number, number]) : null;

  return (
    <MapContainer
      center={latest ?? DEFAULT_CENTER}
      zoom={16}
      // Peta statis (mengikuti posisi otomatis) — jari yang menyentuh peta tetap men-scroll halaman.
      dragging={false}
      touchZoom={false}
      doubleClickZoom={false}
      scrollWheelZoom={false}
      boxZoom={false}
      keyboard={false}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
      style={{ touchAction: 'pan-y' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#ea2845', weight: 5 }} />}
      {latest && (
        <>
          <CircleMarker center={latest} radius={14} pathOptions={{ stroke: false, fillColor: '#ea2845', fillOpacity: 0.18 }} />
          <CircleMarker center={latest} radius={7} pathOptions={{ color: '#fff', weight: 3, fillColor: '#ea2845', fillOpacity: 1 }} />
        </>
      )}
      <FollowLatest position={latest} />
    </MapContainer>
  );
}
