import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { GeoPoint } from '../../types';

const DEFAULT_CENTER: [number, number] = [-6.2183, 106.8022];

/** Menggeser peta mengikuti posisi terakhir. */
function FollowLatest({ position }: { position: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.panTo(position);
  }, [map, position]);
  return null;
}

export default function RouteMap({ points }: { points: GeoPoint[] }) {
  const path = points.map((p) => [p.lat, p.lng] as [number, number]);
  const latest = path.length > 0 ? path[path.length - 1] : null;

  return (
    <MapContainer
      center={latest ?? DEFAULT_CENTER}
      zoom={16}
      zoomControl={false}
      attributionControl
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {path.length > 1 && <Polyline positions={path} pathOptions={{ color: '#ea2845', weight: 5 }} />}
      {latest && (
        <CircleMarker center={latest} radius={7} pathOptions={{ color: '#fff', fillColor: '#ea2845', fillOpacity: 1 }} />
      )}
      <FollowLatest position={latest} />
    </MapContainer>
  );
}
