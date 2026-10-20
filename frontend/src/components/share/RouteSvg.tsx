import type { GeoPoint } from '../../types';

interface RouteSvgProps {
  points: GeoPoint[];
  width?: number;
  height?: number;
  stroke?: string;
  strokeWidth?: number;
  /** Warna garis tepi di bawah rute; null = tanpa outline. */
  outline?: string | null;
  /** Isi titik start (end memakai `stroke`). */
  startFill?: string;
  padding?: number;
  className?: string;
}

/**
 * Render rute sebagai SVG (vektor -> tajam di resolusi berapa pun & aman diekspor ke PNG,
 * tidak seperti tile peta yang terkena CORS). Proyeksi equirectangular dengan koreksi cos(lat).
 */
export default function RouteSvg({
  points,
  width = 300,
  height = 200,
  stroke = '#EA2845',
  strokeWidth = 4,
  outline = null,
  startFill = '#FFFFFF',
  padding = 16,
  className,
}: RouteSvgProps) {
  if (points.length < 2) {
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Route unavailable">
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" fill="currentColor" fontSize="12" opacity={0.6}>
          No route recorded
        </text>
      </svg>
    );
  }

  const k = Math.cos((points[0].lat * Math.PI) / 180);
  const xs = points.map((p) => p.lng * k);
  const ys = points.map((p) => -p.lat);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min((width - padding * 2) / (maxX - minX || 1e-9), (height - padding * 2) / (maxY - minY || 1e-9));
  // Pusatkan rute di dalam kotak.
  const offX = (width - (maxX - minX) * scale) / 2;
  const offY = (height - (maxY - minY) * scale) / 2;
  const pts = xs.map((x, i) => [offX + (x - minX) * scale, offY + (ys[i] - minY) * scale] as const);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const [sx, sy] = pts[0];
  const [ex, ey] = pts[pts.length - 1];
  const r = strokeWidth + 1.5;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className={className} role="img" aria-label="Route map">
      {outline && (
        <path d={d} fill="none" stroke={outline} strokeWidth={strokeWidth + 4} strokeLinecap="round" strokeLinejoin="round" />
      )}
      <path d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={sx} cy={sy} r={r} fill={startFill} stroke={stroke} strokeWidth={2} />
      <circle cx={ex} cy={ey} r={r} fill={stroke} stroke={startFill} strokeWidth={2} />
    </svg>
  );
}
