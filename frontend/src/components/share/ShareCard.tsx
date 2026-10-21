import { forwardRef } from 'react';
import type { CSSProperties } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import RouteSvg from './RouteSvg';
import { estimateCalories, formatDuration, formatPace } from '../../lib/geo';
import { joinLink } from '../../routes';
import type { ActivityLog } from '../../types';

// Warna tetap (tidak ikut light/dark) agar PNG yang dibagikan selalu identik.
const C = {
  red: '#EA2845',
  redDeep: '#B3122E',
  white: '#FFFFFF',
  ink: '#111827',
  soft: 'rgba(255,255,255,0.72)',
  line: 'rgba(255,255,255,0.22)',
};
const FONT = "'Plus Jakarta Sans Variable', 'Plus Jakarta Sans', system-ui, sans-serif";

const STATUS: Record<ActivityLog['missionStatus'], string> = {
  completed: '✓',
  failed: '✗',
  in_progress: '●',
  pending: '●',
  shielded: '🛡',
};

interface ShareCardProps {
  log: ActivityLog;
  username: string;
}

const label: CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: 1,
  textTransform: 'uppercase',
  color: C.soft,
};

/**
 * Kartu 360×640 (diekspor ×3 = 1080×1920, rasio IG Story). Style inline + ukuran tetap
 * agar hasil PNG identik di semua perangkat. `ref` diteruskan ke node yang dirender html-to-image.
 */
const ShareCard = forwardRef<HTMLDivElement, ShareCardProps>(function ShareCard({ log, username }, ref) {
  const metrics = [
    { label: 'Pace /km', value: formatPace(log.durationSec, log.distanceKm) },
    { label: 'Time', value: formatDuration(log.durationSec) },
    { label: 'kcal', value: String(estimateCalories(log.distanceKm, log.type)) },
  ];

  return (
    <div
      ref={ref}
      style={{
        width: 360,
        height: 640,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        padding: 24,
        boxSizing: 'border-box',
        fontFamily: FONT,
        color: C.white,
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
          bottom: 120,
          width: 240,
          height: 240,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.06)',
        }}
      />

      {/* Header */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: 18, height: 18, background: C.white, borderRadius: 1 }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: -0.3 }}>Cidash</span>
        </div>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.soft }}>{log.date}</span>
      </div>

      {/* Rute */}
      <div style={{ position: 'relative', marginTop: 12, height: 232 }}>
        <RouteSvg
          points={log.route}
          width={312}
          height={232}
          stroke={C.white}
          strokeWidth={5}
          outline="rgba(0,0,0,0.12)"
          startFill={C.red}
          padding={18}
          className="block"
        />
      </div>

      {/* Jarak utama */}
      <div style={{ position: 'relative', marginTop: 4 }}>
        <p style={{ ...label, margin: 0 }}>
          {log.type === 'run' ? 'Run' : 'Ride'} · {log.mode === 'group' ? 'Group' : 'Solo'}
        </p>
        <p style={{ margin: 0, display: 'flex', alignItems: 'baseline', gap: 6, lineHeight: 1 }}>
          <span style={{ fontSize: 76, fontWeight: 800, letterSpacing: -3 }}>{log.distanceKm.toFixed(2)}</span>
          <span style={{ fontSize: 22, fontWeight: 700, color: C.soft }}>km</span>
        </p>
      </div>

      {/* Metrik */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${C.line}`,
        }}
      >
        {metrics.map((m, i) => (
          <div
            key={m.label}
            style={{ flex: 1, paddingLeft: i ? 14 : 0, borderLeft: i ? `1px solid ${C.line}` : 'none' }}
          >
            <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{m.value}</p>
            <p style={{ ...label, margin: '2px 0 0' }}>{m.label}</p>
          </div>
        ))}
      </div>

      {/* Status / nama rute */}
      <div style={{ position: 'relative', marginTop: 16 }}>
        <span
          style={{
            display: 'inline-block',
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            padding: '5px 12px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.16)',
            fontSize: 12,
            fontWeight: 700,
            boxSizing: 'border-box',
          }}
        >
          {STATUS[log.missionStatus]} {log.missionStatus === 'failed' ? 'Missed · ' : ''}
          {log.routeLabel}
        </span>
      </div>

      {/* Undangan circle */}
      <div
        style={{
          position: 'relative',
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 12,
          borderRadius: 18,
          background: C.white,
          color: C.ink,
        }}
      >
        {log.circle ? (
          <>
            <QRCodeSVG value={joinLink(log.circle.code)} size={68} level="M" fgColor={C.ink} bgColor={C.white} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: '#6B7280' }}>Run with @{username}</p>
              <p
                style={{
                  margin: '1px 0 4px',
                  fontSize: 14,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {log.circle.name}
              </p>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: 8,
                  background: 'rgba(234,40,69,0.1)',
                  color: C.red,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: 15,
                  fontWeight: 800,
                  letterSpacing: 3,
                }}
              >
                {log.circle.code}
              </span>
            </div>
          </>
        ) : (
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>@{username} on Cidash</p>
        )}
      </div>
    </div>
  );
});

export default ShareCard;
