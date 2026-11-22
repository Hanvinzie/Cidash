import { useId } from 'react';
import { useHomeTheme, type HomeThemeId } from '../../hooks/useHomeTheme';

/* ────────────────────────────── Util ────────────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Hash deterministik → [0,1). Tidak ada Math.random, sehingga posisi bintang/bunga/pohon konsisten. */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const rad = (d: number) => (d * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);

/** Menghasilkan path siluet barisan hutan pohon pinus yang rapat dan organik. */
function buildPineForestPath(
  width: number,
  baseY: number,
  minH: number,
  maxH: number,
  step: number,
  seed: number,
): string {
  const parts: string[] = [`M 0 ${f1(baseY + 8)}`, `L 0 ${f1(baseY)}`];

  for (let x = -4; x <= width + 6; x += step) {
    const jitterX = (hash(x, 1, seed) - 0.5) * step * 0.65;
    const cx = x + jitterX;
    const h = minH + hash(x, 2, seed) * (maxH - minH);
    const w = h * (0.28 + 0.1 * hash(x, 3, seed));
    const topY = baseY - h;

    // 3 tingkat cabang cemara melengkung halus agar terlihat alami, bukan segitiga kaku
    const t1Y = topY + h * 0.34;
    const t1W = w * 0.42;
    const t2Y = topY + h * 0.68;
    const t2W = w * 0.74;

    parts.push(
      `L ${f1(cx - w)} ${f1(baseY)}`,
      `Q ${f1(cx - t2W * 0.85)} ${f1(t2Y + 2)} ${f1(cx - t2W)} ${f1(t2Y)}`,
      `L ${f1(cx - t2W * 0.55)} ${f1(t2Y - 1)}`,
      `Q ${f1(cx - t1W * 0.85)} ${f1(t1Y + 2)} ${f1(cx - t1W)} ${f1(t1Y)}`,
      `L ${f1(cx - t1W * 0.45)} ${f1(t1Y - 1)}`,
      `L ${f1(cx)} ${f1(topY)}`,
      `L ${f1(cx + t1W * 0.45)} ${f1(t1Y - 1)}`,
      `Q ${f1(cx + t1W * 0.85)} ${f1(t1Y + 2)} ${f1(cx + t1W)} ${f1(t1Y)}`,
      `L ${f1(cx + t2W * 0.55)} ${f1(t2Y - 1)}`,
      `Q ${f1(cx + t2W * 0.85)} ${f1(t2Y + 2)} ${f1(cx + t2W)} ${f1(t2Y)}`,
      `L ${f1(cx + w)} ${f1(baseY)}`,
    );
  }

  parts.push(`L ${width} ${f1(baseY)}`, `L ${width} ${f1(baseY + 8)}`, 'Z');
  return parts.join(' ');
}

/* ───────────────────────── Midnight Meadow (Painted) ───────────────────────── */

const MEADOW_STARS = Array.from({ length: 42 }, (_, i) => ({
  x: hash(i, 11, 101) * 400,
  y: hash(i, 12, 101) * 118,
  r: 0.6 + hash(i, 13, 101) * 1.1,
  o: 0.35 + hash(i, 14, 101) * 0.6,
}));

const MEADOW_FLOWERS = Array.from({ length: 46 }, (_, i) => {
  // t = 0 dekat cakrawala (kecil), t = 1 di depan bawah (lebih besar)
  const t = Math.pow(hash(i, 21, 202), 0.78);
  return {
    x: 8 + hash(i, 22, 202) * 384,
    y: 138 + t * 114,
    scale: 0.45 + t * 0.95,
    rot: hash(i, 23, 202) * 360,
    warm: hash(i, 24, 202) > 0.65,
  };
});

function MidnightMeadow() {
  const uid = useId().replace(/:/g, '');
  const backTrees = buildPineForestPath(400, 134, 14, 28, 7, 301);
  const frontTrees = buildPineForestPath(400, 136, 16, 34, 9, 302);

  return (
    <>
      {/* 1. Langit Malam Biru Kobalt */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #071338 0%, #102A71 32%, #1D4ED8 54%, #0B2518 55%)',
        }}
      />

      {/* 2. Bulan Purnama Bercahaya dengan Detail Kawah */}
      <div
        className="absolute right-[9%] top-[8%] aspect-square rounded-full"
        style={{
          height: '32%',
          background:
            'radial-gradient(circle at 62% 58%, rgba(160,178,230,.32) 0 9%, transparent 10%), radial-gradient(circle at 38% 68%, rgba(160,178,230,.25) 0 6%, transparent 7%), radial-gradient(circle at 70% 28%, rgba(160,178,230,.22) 0 5%, transparent 6%), radial-gradient(circle at 32% 30%, #FFFFFF 0%, #F4F7FF 48%, #D6E2FF 100%)',
          boxShadow: '0 0 28px 8px rgba(224,236,255,.55), 0 0 85px 26px rgba(147,197,253,.35)',
        }}
      />

      {/* 3. Ilustrasi Painted SVG: Bintang, Awan Malam, Hutan Pinus & Padang Bunga Aster */}
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <filter id={`${uid}-cloud-blur`} x="-15%" y="-15%" width="130%" height="130%">
            <feGaussianBlur stdDeviation="5.5" />
          </filter>

          <linearGradient id={`${uid}-cloud`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.42" />
            <stop offset="100%" stopColor="#1E3A8A" stopOpacity="0.08" />
          </linearGradient>

          <linearGradient id={`${uid}-grass`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14532D" />
            <stop offset="45%" stopColor="#0F3F22" />
            <stop offset="100%" stopColor="#062412" />
          </linearGradient>

          <radialGradient id={`${uid}-mist`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#1D4ED8" stopOpacity="0" />
          </radialGradient>
        </defs>

        {/* Bintang-bintang kecil */}
        {MEADOW_STARS.map((s, i) => (
          <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#EFF6FF" opacity={s.o} />
        ))}

        {/* Gumpalan awan malam lembut */}
        <g filter={`url(#${uid}-cloud-blur)`}>
          <ellipse cx="78" cy="46" rx="68" ry="14" fill={`url(#${uid}-cloud)`} />
          <ellipse cx="122" cy="54" rx="54" ry="11" fill={`url(#${uid}-cloud)`} />
          <ellipse cx="228" cy="76" rx="76" ry="13" fill={`url(#${uid}-cloud)`} />
          <ellipse cx="52" cy="96" rx="64" ry="10" fill={`url(#${uid}-cloud)`} />
          <ellipse cx="332" cy="98" rx="58" ry="11" fill={`url(#${uid}-cloud)`} />
        </g>

        {/* Kabut tipis di atas garis hutan */}
        <ellipse cx="200" cy="132" rx="220" ry="18" fill={`url(#${uid}-mist)`} />

        {/* Siluet hutan pinus lapisan belakang (biru malam) */}
        <path d={backTrees} fill="#0D256E" opacity="0.85" />

        {/* Siluet hutan pinus lapisan depan (gelap tajam) */}
        <path d={frontTrees} fill="#030712" />

        {/* Padang rumput malam */}
        <rect x="0" y="135" width="400" height="125" fill={`url(#${uid}-grass)`} />

        {/* Tekstur alur rumput halus */}
        {Array.from({ length: 65 }).map((_, i) => {
          const gx = hash(i, 41, 404) * 400;
          const gy = 142 + hash(i, 42, 404) * 112;
          const gh = 5 + hash(i, 43, 404) * 8;
          return (
            <path
              key={i}
              d={`M ${f1(gx)} ${f1(gy)} Q ${f1(gx + 1.5)} ${f1(gy - gh * 0.5)} ${f1(gx - 1)} ${f1(gy - gh)}`}
              stroke="#1E6B3B"
              strokeWidth="1"
              fill="none"
              opacity="0.45"
            />
          );
        })}

        {/* Taburan bunga aster (daisy) putih & kuning lembut */}
        {MEADOW_FLOWERS.map((fl, i) => (
          <g
            key={i}
            transform={`translate(${f1(fl.x)}, ${f1(fl.y)}) scale(${fl.scale.toFixed(2)}) rotate(${f1(fl.rot)})`}
          >
            {/* Daun/bayangan dasar bunga */}
            <ellipse cx="0" cy="1.5" rx="4.5" ry="2.2" fill="#052E16" opacity="0.6" />
            {/* 6 kelopak bunga aster */}
            {[0, 60, 120].map((deg) => (
              <ellipse
                key={deg}
                cx="0"
                cy="0"
                rx="4.4"
                ry="1.35"
                transform={`rotate(${deg})`}
                fill={fl.warm ? '#FEF9C3' : '#F8FAFC'}
                opacity="0.92"
              />
            ))}
            {/* Putik tengah */}
            <circle cx="0" cy="0" r="1.45" fill="#FBBF24" />
          </g>
        ))}
      </svg>
    </>
  );
}

/* ───────────────────────── Cyber Aurora (Painted) ───────────────────────── */

const AURORA_STARS = Array.from({ length: 55 }, (_, i) => ({
  x: hash(i, 51, 505) * 400,
  y: hash(i, 52, 505) * 136,
  r: 0.5 + hash(i, 53, 505) * 1.15,
  o: 0.3 + hash(i, 54, 505) * 0.65,
  sparkle: hash(i, 55, 505) > 0.86,
}));

function CyberAurora() {
  const uid = useId().replace(/:/g, '');
  const leftIslandTrees = buildPineForestPath(165, 144, 10, 22, 6, 601);
  const rightIslandTrees = buildPineForestPath(195, 144, 11, 25, 6, 602);

  return (
    <>
      {/* 1. Langit Malam Kutub & Permukaan Danau */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #020617 0%, #071938 36%, #0B2948 55%, #071E3D 56%, #030917 100%)',
        }}
      />

      {/* 2. Ilustrasi Painted SVG: Pita Aurora Borealis, Pulau Pinus & Pantulan Air */}
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          {/* Blur lembut untuk pendaran aurora */}
          <filter id={`${uid}-aurora-glow`} x="-20%" y="-30%" width="140%" height="160%">
            <feGaussianBlur stdDeviation="7" />
          </filter>

          <filter id={`${uid}-aurora-core`} x="-10%" y="-20%" width="120%" height="140%">
            <feGaussianBlur stdDeviation="2.2" />
          </filter>

          <filter id={`${uid}-water-blur`} x="-10%" y="-10%" width="120%" height="120%">
            <feGaussianBlur stdDeviation="3.5" />
          </filter>

          {/* Gradasi tirai aurora atas (emerald → cyan → semburat ungu) */}
          <linearGradient id={`${uid}-curtain-1`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#00F5D4" stopOpacity="0.95" />
            <stop offset="40%" stopColor="#00BBF9" stopOpacity="0.62" />
            <stop offset="80%" stopColor="#818CF8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#312E81" stopOpacity="0" />
          </linearGradient>

          {/* Gradasi tirai aurora kedua (cyan terang → toska) */}
          <linearGradient id={`${uid}-curtain-2`} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#5EEAD4" stopOpacity="0.9" />
            <stop offset="50%" stopColor="#38BDF8" stopOpacity="0.48" />
            <stop offset="100%" stopColor="#0EA5E9" stopOpacity="0" />
          </linearGradient>

          {/* Gradasi air danau */}
          <linearGradient id={`${uid}-lake`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0B2A4A" />
            <stop offset="50%" stopColor="#071B34" />
            <stop offset="100%" stopColor="#030816" />
          </linearGradient>
        </defs>

        {/* Bintang-bintang malam */}
        {AURORA_STARS.map((s, i) => (
          <g key={i} opacity={s.o}>
            <circle cx={s.x} cy={s.y} r={s.r} fill="#F8FAFC" />
            {s.sparkle && (
              <path
                d={`M ${f1(s.x - 3)} ${f1(s.y)} L ${f1(s.x + 3)} ${f1(s.y)} M ${f1(s.x)} ${f1(s.y - 3)} L ${f1(s.x)} ${f1(s.y + 3)}`}
                stroke="#E0F2FE"
                strokeWidth="0.6"
              />
            )}
          </g>
        ))}

        {/* Pita Aurora 1 (Lapisan belakang atas, melengkung dari kiri atas ke kanan tengah) */}
        <g filter={`url(#${uid}-aurora-glow)`}>
          <path
            d="M -20 42 C 65 24, 145 58, 225 64 C 295 69, 355 52, 420 58 L 420 0 L -20 0 Z"
            fill={`url(#${uid}-curtain-1)`}
          />
        </g>
        {/* Inti garis terang pita aurora 1 */}
        <path
          d="M -20 42 C 65 24, 145 58, 225 64 C 295 69, 355 52, 420 58"
          stroke="#99F6E4"
          strokeWidth="2.8"
          fill="none"
          opacity="0.85"
          filter={`url(#${uid}-aurora-core)`}
        />

        {/* Pita Aurora 2 (Lapisan depan melengkung menyapu di atas cakrawala) */}
        <g filter={`url(#${uid}-aurora-glow)`}>
          <path
            d="M -20 112 C 55 82, 145 78, 235 94 C 310 107, 360 116, 420 104 L 420 32 C 350 44, 295 36, 225 24 C 140 10, 55 18, -20 45 Z"
            fill={`url(#${uid}-curtain-2)`}
          />
        </g>
        {/* Inti pita cahaya bawah aurora 2 */}
        <path
          d="M -20 112 C 55 82, 145 78, 235 94 C 310 107, 360 116, 420 104"
          stroke="#5EEAD4"
          strokeWidth="3.2"
          fill="none"
          opacity="0.92"
          filter={`url(#${uid}-aurora-core)`}
        />

        {/* Pendaran cahaya aurora tipis di dekat cakrawala */}
        <path
          d="M 20 132 Q 190 124 380 134"
          stroke="#2DD4BF"
          strokeWidth="4"
          fill="none"
          opacity="0.45"
          filter={`url(#${uid}-aurora-glow)`}
        />

        {/* Siluet Pulau & Hutan Pinus di Cakrawala */}
        <g fill="#020617">
          {/* Pulau kiri */}
          <path d="M 12 145 Q 85 136 162 145 Z" />
          <g transform="translate(8, 0)">
            <path d={leftIslandTrees} />
          </g>

          {/* Pulau kanan */}
          <path d="M 195 145 Q 295 133 392 145 Z" />
          <g transform="translate(198, 0)">
            <path d={rightIslandTrees} />
          </g>
        </g>

        {/* Permukaan Danau Malam */}
        <rect x="0" y="145" width="400" height="115" fill={`url(#${uid}-lake)`} />

        {/* Pantulan Aurora di Permukaan Air Danau */}
        <g filter={`url(#${uid}-water-blur)`} opacity="0.65">
          <ellipse cx="115" cy="176" rx="88" ry="14" fill="#14B8A6" opacity="0.45" />
          <ellipse cx="265" cy="194" rx="115" ry="18" fill="#0EA5E9" opacity="0.42" />
          <ellipse cx="185" cy="222" rx="135" ry="16" fill="#2DD4BF" opacity="0.32" />
        </g>

        {/* Bayangan gelap pulau di air */}
        <path d="M 18 146 Q 85 154 156 146 Z" fill="#020617" opacity="0.7" />
        <path d="M 202 146 Q 295 156 388 146 Z" fill="#020617" opacity="0.7" />

        {/* Riak air horizontal halus */}
        {Array.from({ length: 34 }).map((_, i) => {
          const rx = hash(i, 71, 707) * 360;
          const ry = 152 + hash(i, 72, 707) * 98;
          const rw = 16 + hash(i, 73, 707) * 38;
          const isLit = hash(i, 74, 707) > 0.45;
          return (
            <line
              key={i}
              x1={f1(rx)}
              y1={f1(ry)}
              x2={f1(rx + rw)}
              y2={f1(ry)}
              stroke={isLit ? '#5EEAD4' : '#1E3A5F'}
              strokeWidth={isLit ? '1.1' : '0.9'}
              strokeLinecap="round"
              opacity={isLit ? 0.34 : 0.45}
            />
          );
        })}
      </svg>
    </>
  );
}

/* ───────────────────────── Vice Sunset (Painted) ───────────────────────── */

function frondPath(cx: number, cy: number, angleDeg: number, len: number, droop: number, width: number) {
  const a = rad(angleDeg);
  const dx = Math.cos(a);
  const dy = Math.sin(a);
  const tx = cx + dx * len;
  const ty = cy + dy * len + droop;
  const mx = cx + dx * len * 0.55;
  const my = cy + dy * len * 0.55 - len * 0.18;
  const nx = -dy;
  const ny = dx;
  return `M${f1(cx)} ${f1(cy)}Q${f1(mx + nx * width)} ${f1(my + ny * width)} ${f1(tx)} ${f1(ty)}Q${f1(mx - nx * width)} ${f1(my - ny * width)} ${f1(cx)} ${f1(cy)}Z`;
}

function trunkPath(x0: number, y0: number, x1: number, y1: number, bend: number, w0: number, w1: number) {
  const N = 14;
  const L: string[] = [];
  const R: string[] = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const x = x0 + (x1 - x0) * t + Math.sin(t * Math.PI) * bend;
    const y = y0 + (y1 - y0) * t;
    const w = (w0 + (w1 - w0) * t) / 2;
    L.push(`${f1(x - w)},${f1(y)}`);
    R.unshift(`${f1(x + w)},${f1(y)}`);
  }
  return `M${L.join('L')}L${R.join('L')}Z`;
}

interface PalmSpec {
  x: number;
  h: number;
  lean: number;
  bend: number;
  fill: string;
  seed: number;
  baseY?: number;
}
const FROND_ANGLES = [-172, -148, -124, -100, -76, -52, -28, -4, 18, 162];

function Palm({ x, h, lean, bend, fill, seed, baseY = 212 }: PalmSpec) {
  const cx = x + lean;
  const cy = baseY - h;
  const len = h * 0.28;
  return (
    <g fill={fill}>
      <path d={trunkPath(x, baseY, cx, cy, bend, 8, 4.5)} />
      {FROND_ANGLES.map((deg, i) => {
        const L = len * (0.78 + 0.45 * hash(i, seed, 9));
        const droop = L * 0.46 * (1 - Math.abs(Math.sin(rad(deg))));
        return <path key={deg} d={frondPath(cx, cy, deg, L, droop, L * 0.13)} />;
      })}
      <circle cx={cx - 2.5} cy={cy + 3.5} r="2.8" />
      <circle cx={cx + 2.5} cy={cy + 4.5} r="2.8" />
    </g>
  );
}

const LEFT_PALMS: PalmSpec[] = [
  { x: 96, h: 124, lean: 22, bend: -8, fill: '#6C3BA8', seed: 1, baseY: 208 },
  { x: 38, h: 158, lean: 34, bend: -12, fill: '#562C8E', seed: 2, baseY: 212 },
  { x: 10, h: 102, lean: 18, bend: -6, fill: '#45207A', seed: 3, baseY: 214 },
];
const RIGHT_PALMS: PalmSpec[] = [
  { x: 64, h: 132, lean: 24, bend: -9, fill: '#6C3BA8', seed: 4, baseY: 208 },
  { x: 22, h: 164, lean: 32, bend: -11, fill: '#562C8E', seed: 5, baseY: 212 },
  { x: 95, h: 96, lean: 14, bend: -5, fill: '#45207A', seed: 6, baseY: 214 },
];

function PalmCluster({ side }: { side: 'left' | 'right' }) {
  const palms = side === 'left' ? LEFT_PALMS : RIGHT_PALMS;
  return (
    <svg
      viewBox="0 0 160 260"
      preserveAspectRatio="xMinYMax meet"
      className={`pointer-events-none absolute bottom-0 h-full w-[48%] ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{ overflow: 'visible', transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {palms.map((p) => (
        <Palm key={p.seed} {...p} />
      ))}
    </svg>
  );
}

interface TowerSpec {
  x: number;
  y: number;
  w: number;
  h: number;
  hasWindows?: boolean;
  crown?: boolean;
}

const MIAMI_TOWERS: TowerSpec[] = [
  { x: 56, y: 112, w: 34, h: 98, hasWindows: true },
  { x: 106, y: 92, w: 30, h: 118 },
  { x: 152, y: 68, w: 42, h: 142, hasWindows: true, crown: true },
  { x: 204, y: 122, w: 28, h: 88 },
  { x: 268, y: 116, w: 36, h: 94, hasWindows: true },
  { x: 312, y: 102, w: 32, h: 108 },
];

function ViceSunset() {
  const uid = useId().replace(/:/g, '');

  return (
    <>
      {/* 1. Langit Senja Vice City */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #FF5CA8 0%, #FF7EB3 34%, #FF9E9D 64%, #FFC482 82%)',
        }}
      />

      {/* 2. Pendaran Matahari Hangat di Cakrawala */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 68% 58% at 50% 76%, rgba(255, 229, 165, 0.78) 0%, rgba(255, 182, 133, 0.36) 45%, transparent 74%)',
        }}
      />

      {/* 3. Siluet Gedung Pencakar Langit Miami & Garis Pantai Teluk */}
      <svg
        viewBox="0 0 400 260"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id={`${uid}-tower`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8E54C1" stopOpacity="0.9" />
            <stop offset="55%" stopColor="#B873D1" stopOpacity="0.72" />
            <stop offset="100%" stopColor="#F598B8" stopOpacity="0.28" />
          </linearGradient>

          <linearGradient id={`${uid}-treeline`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#65349E" />
            <stop offset="100%" stopColor="#48217D" />
          </linearGradient>

          <linearGradient id={`${uid}-sand`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#FFC88A" />
            <stop offset="55%" stopColor="#FFAE8F" />
            <stop offset="100%" stopColor="#F78FB3" />
          </linearGradient>

          <linearGradient id={`${uid}-bay`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#A55EEA" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#C471ED" stopOpacity="0.92" />
            <stop offset="100%" stopColor="#9B5DE5" stopOpacity="0.95" />
          </linearGradient>
        </defs>

        {MIAMI_TOWERS.map((t, idx) => (
          <g key={idx}>
            {t.crown && (
              <rect
                x={t.x + 6}
                y={t.y - 5}
                width={t.w - 12}
                height={6}
                rx={1.5}
                fill={`url(#${uid}-tower)`}
              />
            )}
            <rect
              x={t.x}
              y={t.y}
              width={t.w}
              height={t.h}
              rx={2}
              fill={`url(#${uid}-tower)`}
            />
            {t.hasWindows &&
              Array.from({ length: Math.floor((t.h - 18) / 8) }).map((_, r) =>
                Array.from({ length: Math.floor((t.w - 8) / 6) }).map((__, c) => {
                  const lit = hash(r + idx * 7, c + idx * 3, 19) > 0.28;
                  if (!lit) return null;
                  return (
                    <rect
                      key={`${r}-${c}`}
                      x={t.x + 5 + c * 6}
                      y={t.y + 8 + r * 8}
                      width={3}
                      height={4}
                      rx={0.6}
                      fill="#FFD8A8"
                      opacity={0.45 + 0.35 * hash(r, c, 23)}
                    />
                  );
                }),
              )}
          </g>
        ))}

        <path
          d="M0 212 L0 194 Q18 184 36 193 Q55 180 78 192 Q102 183 125 194 Q150 182 178 193 Q205 184 232 195 Q258 181 285 193 Q312 183 340 194 Q370 182 400 192 L400 212 Z"
          fill={`url(#${uid}-treeline)`}
        />

        <rect x="0" y="210" width="400" height="50" fill={`url(#${uid}-sand)`} />

        <path
          d="M400 212 L145 212 C75 216 68 228 158 235 C235 241 325 243 400 245 Z"
          fill={`url(#${uid}-bay)`}
        />

        <ellipse cx="322" cy="225" rx="34" ry="7" fill="#FFD6E0" opacity="0.48" />
        <ellipse cx="220" cy="227" rx="52" ry="3.5" fill="#FFC8DD" opacity="0.35" />
        <path
          d="M95 246 Q180 243 265 247 T400 249 L400 260 L0 260 L0 250 Q48 248 95 246 Z"
          fill="#E066B8"
          opacity="0.45"
        />
      </svg>

      {/* 4. Siluet Pohon Palem Ungu Indigo di Depan */}
      <PalmCluster side="left" />
      <PalmCluster side="right" />
    </>
  );
}

/* ───────────────────────── Ekspor ───────────────────────── */

const FADE_MASK =
  'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0.85) 55%, rgba(0,0,0,0) 100%)';

/** Hanya ilustrasi (tanpa hook, tanpa mask). Dipakai juga untuk preview di Appearance. */
export function HomeThemeScene({ theme }: { theme: HomeThemeId }) {
  switch (theme) {
    case 'vice-sunset':
      return <ViceSunset />;
    case 'ascii-meadow':
      return <MidnightMeadow />;
    case 'ascii-aurora':
      return <CyberAurora />;
    default:
      return null;
  }
}

interface HomeThemeBackdropProps {
  /** Override tema (opsional). Default: dari useHomeTheme(). */
  theme?: HomeThemeId;
  /** Ganti tinggi default, mis. "h-[30vh]". */
  className?: string;
}

export default function HomeThemeBackdrop({ theme, className }: HomeThemeBackdropProps) {
  const { homeTheme } = useHomeTheme();
  const active = theme ?? homeTheme;
  if (active === 'none') return null;

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-x-0 top-0 z-0 select-none overflow-hidden ${className ?? 'h-[28vh]'}`}
      style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
    >
      <HomeThemeScene theme={active} />
    </div>
  );
}