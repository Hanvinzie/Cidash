import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import RouteSvg from './RouteSvg';
import { estimateCalories, formatDuration, formatPace } from '../../lib/geo';
import type { ActivityLog } from '../../types';

// Warna tetap (tidak ikut light/dark) agar PNG yang dibagikan selalu identik.
const C = {
  red: '#EA2845',
  redDeep: '#B3122E',
  white: '#FFFFFF',
  soft: 'rgba(255,255,255,0.74)',
  line: 'rgba(255,255,255,0.24)',
};
const FONT = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif";

/** Ukuran kartu (px CSS). Diekspor ×3 = 1080×1920 (rasio IG Story). */
export const SHARE_CARD_WIDTH = 360;
export const SHARE_CARD_HEIGHT = 640;
/** Radius sudut kartu. Dipakai juga oleh pembungkus pratinjau agar sudutnya identik. */
export const SHARE_CARD_RADIUS = 28;

interface ShareCardProps {
  log: ActivityLog;
}

const label: CSSProperties = {
  margin: '3px 0 0',
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: C.soft,
};

/**
 * Kartu bersih: logo & nama, tanggal, rute, jarak, pace, waktu, dan kalori. Tanpa lokasi, QR, atau kode circle.
 * Style inline + ukuran tetap agar hasil PNG identik di semua perangkat. `ref` diteruskan ke node yang dirender
 * html-to-image; node ini sendiri yang memegang border-radius sehingga PNG hasil ekspor punya sudut transparan
 * yang rapi (tidak ada sudut putih tajam di luar lengkungan).
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard({ log }, ref) {
  const metrics = [
    { label: 'Pace /km', value: formatPace(log.durationSec, log.distanceKm) },
    { label: 'Time', value: formatDuration(log.durationSec) },
    { label: 'kcal', value: String(estimateCalories(log.distanceKm, log.type)) },
  ];

  return (
    <div
      ref={ref}
      style={{
        width: SHARE_CARD_WIDTH,
        height: SHARE_CARD_HEIGHT,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 26,
        boxSizing: 'border-box',
        fontFamily: FONT,
        color: C.white,
        borderRadius: SHARE_CARD_RADIUS,
        background: `linear-gradient(165deg, ${C.red} 0%, ${C.redDeep} 100%)`,
      }}
    >
      {/* Ornamen lingkaran khas kartu saldo Cidash */}
      <div
        style={{
          position: 'absolute',
          right: -90,
          top: -90,
          width: 260,
          height: 260,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: -120,
          bottom: -40,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.07)',
        }}
      />

      {/* Header: logo + nama, tanggal */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Latar kartu merah → logo primary (tile terang). Same-origin, jadi ikut terekspor tanpa CORS. */}
          <img src="/brand/logo-cidash-primary.svg" alt="" width={30} height={30} style={{ width: 30, height: 30, borderRadius: 6 }} />
          <span
            style={{
              fontFamily: '"Rubik One", system-ui, sans-serif',
              fontSize: 19,
              fontWeight: 400,
              letterSpacing: 1,
              textTransform: 'uppercase',
            }}
          >
            CIDASH
          </span>
        </div>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.soft }}>{log.date}</span>
      </div>

      {/* Rute: mengisi ruang tersisa agar kartu terasa lega */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0, margin: '14px 0 10px', display: 'flex' }}>
        <RouteSvg
          points={log.route}
          width={308}
          height={300}
          stroke={C.white}
          strokeWidth={5}
          outline="rgba(0,0,0,0.14)"
          startFill={C.red}
          padding={20}
          className="block h-full w-full"
        />
      </div>

      {/* Jarak utama */}
      <div style={{ position: 'relative' }}>
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
          <span style={{ fontSize: 80, fontWeight: 800, letterSpacing: -3 }}>{log.distanceKm.toFixed(2)}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.soft }}>km</span>
        </p>
        <p style={{ ...label, margin: '6px 0 0' }}>Distance</p>
      </div>

      {/* Pace · Time · Calories */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          marginTop: 18,
          paddingTop: 16,
          borderTop: `1px solid ${C.line}`,
        }}
      >
        {metrics.map((m, i) => (
          <div
            key={m.label}
            style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeft: i ? `1px solid ${C.line}` : 'none' }}
          >
            <p style={{ margin: 0, fontSize: 21, fontWeight: 800 }}>{m.value}</p>
            <p style={label}>{m.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
});

export default ShareCard;
