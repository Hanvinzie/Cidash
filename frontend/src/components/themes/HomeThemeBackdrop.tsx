import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { useHomeTheme, type HomeThemeId } from '../../hooks/useHomeTheme';

/* ────────────────────────────── Util ────────────────────────────── */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const smooth = (a: number, b: number, v: number) => {
  const t = clamp01((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/** Hash deterministik → [0,1). Tidak ada Math.random, jadi tidak berkedip saat resize. */
function hash(x: number, y: number, seed = 0): number {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function vnoise(x: number, y: number, seed: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const fbm = (x: number, y: number, seed: number) =>
  vnoise(x, y, seed) * 0.55 + vnoise(x * 2.1, y * 2.1, seed + 7) * 0.3 + vnoise(x * 4.3, y * 4.3, seed + 13) * 0.15;

function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const k = clamp01(t);
  const ch = (s: number) => {
    const va = (pa >> s) & 255;
    const vb = (pb >> s) & 255;
    return Math.round(va + (vb - va) * k).toString(16).padStart(2, '0');
  };
  return `#${ch(16)}${ch(8)}${ch(0)}`;
}

/* ─────────────────────── Kanvas ASCII prosedural ─────────────────────── */

interface Cell {
  ch: string;
  fg: string;
  bg?: string;
}
type Grid = (Cell | undefined)[][];
interface Env {
  cols: number;
  rows: number;
  charW: number;
}
interface Layer {
  grid: Grid;
  glow?: string;
}

const FONT_PX = 9;
const LINE_PX = 9;

const newGrid = (env: Env): Grid =>
  Array.from({ length: env.rows }, () => new Array<Cell | undefined>(env.cols));

const put = (g: Grid, x: number, y: number, cell: Cell) => {
  if (y >= 0 && y < g.length && x >= 0 && x < g[0].length) g[y][x] = cell;
};

function renderRow(row: (Cell | undefined)[], cols: number): ReactNode[] {
  const out: ReactNode[] = [];
  let buf = '';
  let fg: string | null = null;
  let bg: string | undefined;
  let key = 0;
  const flush = () => {
    if (!buf) return;
    out.push(
      fg ? (
        <span key={key++} style={{ color: fg, backgroundColor: bg }}>
          {buf}
        </span>
      ) : (
        buf
      ),
    );
    buf = '';
  };
  for (let x = 0; x < cols; x++) {
    const cell = row[x];
    if (!cell) {
      if (bg !== undefined) {
        flush();
        fg = null;
        bg = undefined;
      }
      buf += ' ';
    } else {
      if (cell.fg !== fg || cell.bg !== bg) {
        flush();
        fg = cell.fg;
        bg = cell.bg;
      }
      buf += cell.ch;
    }
  }
  flush();
  return out;
}

function AsciiCanvas({ build }: { build: (env: Env) => Layer[] }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const probeRef = useRef<HTMLSpanElement>(null);
  const [env, setEnv] = useState<Env | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    const probe = probeRef.current;
    if (!host || !probe) return;
    const measure = () => {
      // offsetWidth/Height tidak terpengaruh transform scale (dipakai di preview mini).
      const charW = probe.offsetWidth / 100 || FONT_PX * 0.6;
      const cols = Math.ceil(host.offsetWidth / charW) + 1;
      const rows = Math.floor(host.offsetHeight / LINE_PX);
      if (cols < 8 || rows < 4) return;
      setEnv((prev) =>
        prev && prev.cols === cols && prev.rows === rows && Math.abs(prev.charW - charW) < 0.01
          ? prev
          : { cols, rows, charW },
      );
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    return () => ro.disconnect();
  }, []);

  const layers = useMemo(() => (env ? build(env) : []), [env, build]);

  return (
    <div ref={hostRef} className="absolute inset-0 overflow-hidden">
      <span
        ref={probeRef}
        aria-hidden="true"
        className="invisible absolute left-0 top-0 whitespace-pre font-mono"
        style={{ fontSize: FONT_PX }}
      >
        {'0'.repeat(100)}
      </span>
      {env &&
        layers.map((layer, i) => (
          <div
            key={i}
            className="absolute bottom-0 left-0 overflow-hidden font-mono"
            style={{
              width: '100%',
              height: env.rows * LINE_PX,
              fontSize: FONT_PX,
              lineHeight: `${LINE_PX}px`,
              fontVariantLigatures: 'none',
              filter: layer.glow ? `drop-shadow(0 0 3px ${layer.glow})` : undefined,
            }}
          >
            {layer.grid.map((row, y) => (
              <div key={y} className="whitespace-pre" style={{ height: LINE_PX }}>
                {renderRow(row, env.cols)}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}

function drawPine(g: Grid, cx: number, baseY: number, ht: number, bg: string, edge: string) {
  const maxHalf = Math.max(2, Math.round(ht * 0.38));
  for (let r = 0; r < ht; r++) {
    const half = Math.floor((r / ht) * maxHalf) + (r % 3 === 0 && r > 0 ? 1 : 0); // tingkat bergerigi
    const y = baseY - ht + 1 + r;
    for (let dx = -half; dx <= half; dx++) {
      const isEdge = Math.abs(dx) === half;
      const ch = r === 0 ? '^' : isEdge ? (dx < 0 ? '/' : '\\') : '#';
      put(g, cx + dx, y, { ch, fg: isEdge ? edge : bg, bg });
    }
  }
  put(g, cx, baseY + 1, { ch: '|', fg: edge, bg });
}

interface TreeLineOpts {
  seed: number;
  step: number;
  spread: number;
  min: number;
  vary: number;
  bg: string;
  edge: string;
}
function treeLine(g: Grid, cols: number, rows: number, baseY: number, o: TreeLineOpts) {
  for (let x = -2; x < cols + 2; x += o.step + Math.floor(hash(x, 1, o.seed) * o.spread)) {
    const mid = 0.7 + 0.3 * Math.sin((Math.min(cols, Math.max(0, x)) / cols) * Math.PI);
    const ht = Math.max(4, Math.round(rows * (o.min + o.vary * hash(x, 2, o.seed)) * mid));
    drawPine(g, x, baseY, ht, o.bg, o.edge);
  }
}

/* ───────────────────────── Midnight Meadow ───────────────────────── */

function buildMeadow(env: Env): Layer[] {
  const { cols, rows, charW } = env;
  const g = newGrid(env);
  const horizon = Math.floor(rows * 0.52);

  // Pusat & radius bulan (harus sinkron dengan elemen CSS bulan)
  const moonR = 0.17 * rows * LINE_PX;
  const moonX = cols * 0.92 - moonR / charW;
  const moonY = rows * 0.25;

  // Awan: kisi karakter 8 B 0 : .
  for (let y = 0; y < horizon - 1; y++) {
    const band = smooth(0, 0.12, y / horizon) * (1 - smooth(0.62, 0.95, y / horizon));
    for (let x = 0; x < cols; x++) {
      const ux = (x * charW) / LINE_PX;
      const n = fbm(ux * 0.085, y * 0.13, 3);
      let v = clamp01((n - 0.54) / 0.18) * band;
      const dist = Math.hypot((x - moonX) * charW, (y - moonY) * LINE_PX) / moonR;
      v *= smooth(1.0, 2.2, dist); // jaga area bulan tetap bersih
      if (v < 0.12) continue;
      const ch = v > 0.8 ? '8' : v > 0.6 ? 'B' : v > 0.42 ? '0' : v > 0.26 ? ':' : '.';
      put(g, x, y, { ch, fg: mix('#5B84E0', '#EAF2FF', v) });
    }
  }

  // Padang rumput + bunga aster (@ o *)
  for (let y = horizon; y < rows; y++) {
    const t = (y - horizon) / Math.max(1, rows - horizon);
    const bg = mix('#0F4A25', '#052E16', t);
    const flowerChance = 0.03 + 0.06 * t;
    for (let x = 0; x < cols; x++) {
      const r = hash(x, y, 31);
      if (r < flowerChance) {
        const k = hash(x, y, 32);
        const ch = k < 0.4 ? '@' : k < 0.75 ? 'o' : '*';
        const fg = k < 0.4 ? '#FFFFFF' : k < 0.75 ? '#FDE68A' : '#FEF08A';
        g[y][x] = { ch, fg, bg };
      } else {
        const k = hash(x, y, 33);
        const ch = k < 0.3 ? '"' : k < 0.55 ? ',' : k < 0.75 ? "'" : k < 0.9 ? ';' : '.';
        g[y][x] = { ch, fg: mix('#1F8A41', '#0E5A28', hash(x, y, 34)), bg };
      }
    }
  }

  // Barisan pinus: belakang (biru tua) lalu depan (hitam)
  const baseY = horizon - 1;
  treeLine(g, cols, rows, baseY, { seed: 21, step: 3, spread: 4, min: 0.16, vary: 0.12, bg: '#0A1F63', edge: '#173596' });
  treeLine(g, cols, rows, baseY, { seed: 22, step: 5, spread: 5, min: 0.2, vary: 0.14, bg: '#02050F', edge: '#0D1638' });

  return [{ grid: g }];
}

function MidnightMeadow() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, #0B1A4A 0%, #1D4ED8 100%)' }}
      />
      <div
        className="absolute right-[8%] top-[8%] aspect-square rounded-full"
        style={{
          height: '34%',
          background:
            'radial-gradient(circle at 62% 58%, rgba(160,178,230,.35) 0 9%, transparent 10%), radial-gradient(circle at 38% 68%, rgba(160,178,230,.28) 0 6%, transparent 7%), radial-gradient(circle at 70% 28%, rgba(160,178,230,.25) 0 5%, transparent 6%), radial-gradient(circle at 32% 30%, #fff 0%, #F6F8FF 45%, #DCE5FF 100%)',
          boxShadow: '0 0 24px 8px rgba(220,232,255,.55), 0 0 80px 24px rgba(147,180,255,.35)',
        }}
      />
      <AsciiCanvas build={buildMeadow} />
    </>
  );
}

/* ───────────────────────── Cyber Aurora ───────────────────────── */

const SKY_BG = '#071A3A';
const SIL = '#02050F';

interface Ribbon {
  y0: number;
  a1: number;
  f1: number;
  p1: number;
  a2: number;
  f2: number;
  p2: number;
  len: number;
  c0: string;
  c1: string;
  seed: number;
}
const RIBBONS: Ribbon[] = [
  { y0: 0.62, a1: 0.1, f1: 0.18, p1: 0.8, a2: 0.05, f2: 0.43, p2: 2.0, len: 0.58, c0: '#00F5D4', c1: '#38BDF8', seed: 41 },
  { y0: 0.44, a1: 0.09, f1: 0.14, p1: 3.0, a2: 0.04, f2: 0.47, p2: 0.4, len: 0.42, c0: '#00BBF9', c1: '#00F5D4', seed: 57 },
];

function buildAurora(env: Env): Layer[] {
  const { cols, rows, charW } = env;
  const base = newGrid(env);
  const glow = newGrid(env);
  const horizon = Math.floor(rows * 0.56);

  /** Intensitas tirai aurora di (x,y) — tirai vertikal, terang di tepi bawah, memudar ke atas. */
  const aurora = (x: number, y: number): { v: number; color: string } | null => {
    const ux = (x * charW) / LINE_PX;
    let best = 0;
    let color = '#00F5D4';
    for (const rb of RIBBONS) {
      const by = horizon * (rb.y0 + rb.a1 * Math.sin(ux * rb.f1 + rb.p1) + rb.a2 * Math.sin(ux * rb.f2 + rb.p2));
      const len = horizon * rb.len * (0.65 + 0.35 * vnoise(ux * 0.15, 5, rb.seed));
      const dy = by - y;
      if (dy < -1 || dy > len) continue;
      const t = clamp01(dy / len);
      const ray = 0.3 + 0.7 * vnoise(x * 0.45, rb.seed, rb.seed); // garis vertikal
      const v = Math.pow(1 - t, 1.3) * smooth(-1.2, 1.5, dy) * ray;
      if (v > best) {
        best = v;
        color = mix(rb.c0, rb.c1, t);
      }
    }
    return best >= 0.12 ? { v: best, color } : null;
  };

  // Bintang + tirai aurora
  for (let y = 0; y < horizon; y++) {
    for (let x = 0; x < cols; x++) {
      const a = aurora(x, y);
      if (a) {
        const ch = a.v > 0.72 ? '|' : a.v > 0.52 ? 'I' : a.v > 0.36 ? '1' : a.v > 0.22 ? ':' : '.';
        glow[y][x] = { ch, fg: mix(SKY_BG, a.color, 0.3 + a.v * 0.9) };
      } else {
        const r = hash(x, y, 61);
        if (r > 0.988) base[y][x] = { ch: '*', fg: '#F1F5F9' };
        else if (r > 0.978) base[y][x] = { ch: '+', fg: '#CBD5E1' };
        else if (r > 0.945) base[y][x] = { ch: '.', fg: '#64748B' };
      }
    }
  }

  // Pulau berhutan pinus (siluet hitam)
  const cx = cols * 0.5;
  const half = cols * 0.3;
  const mound = (x: number) => {
    const u = (x - cx) / half;
    return Math.abs(u) >= 1 ? 0 : Math.round(Math.pow(1 - u * u, 0.7) * rows * 0.07);
  };
  for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
    for (let y = horizon - mound(x); y <= horizon + 1; y++) {
      put(base, x, y, { ch: '#', fg: '#0B1424', bg: SIL });
    }
  }
  for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x += 2 + Math.floor(hash(x, 7, 62) * 3)) {
    const u = (x - cx) / half;
    const shape = Math.sqrt(Math.max(0, 1 - u * u));
    if (shape < 0.1) continue;
    const ht = Math.max(3, Math.round(rows * (0.1 + 0.14 * hash(x, 3, 62)) * (0.5 + 0.5 * shape)));
    drawPine(base, x, horizon - mound(x), ht, SIL, '#0E1B30');
  }

  // Danau: riak + pantulan aurora + pantulan pulau
  const waterTop = horizon + 2;
  for (let y = waterTop; y < rows; y++) {
    const t = (y - waterTop) / Math.max(1, rows - waterTop);
    const bg = mix('#0A1D3D', '#030814', t);
    const mirrorY = Math.round(horizon - (y - waterTop + 1) * 1.4);
    const islandY = horizon + 1 - (y - waterTop);
    for (let x = 0; x < cols; x++) {
      const ripple = Math.round(Math.sin(y * 1.9 + x * 0.12) * 1.5);
      base[y][x] = hash(x, y, 63) > 0.93 ? { ch: '~', fg: '#1E3A5F', bg } : { ch: ' ', fg: bg, bg };

      const src = islandY >= 0 ? base[islandY]?.[x] : undefined;
      if (src && src.bg === SIL && y % 2 === 0) base[y][x] = { ch: ':', fg: '#0A1A30', bg: '#040B18' };

      const a = mirrorY >= 0 ? aurora(x + ripple, mirrorY) : null;
      if (a) {
        const v = a.v * 0.6;
        if (v > 0.1) {
          const ch = v > 0.35 ? '=' : v > 0.22 ? '~' : '-';
          glow[y][x] = { ch, fg: mix(bg, a.color, 0.35 + v * 0.9) };
        }
      }
    }
  }

  return [{ grid: base }, { grid: glow, glow: 'rgba(0,245,212,0.75)' }];
}

function CyberAurora() {
  return (
    <>
      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(to bottom, #020617 0%, #071A3A 55%, #0C3558 100%)' }}
      />
      <AsciiCanvas build={buildAurora} />
    </>
  );
}

/* ───────────────────────── Vice Sunset ───────────────────────── */

const rad = (d: number) => (d * Math.PI) / 180;
const f1 = (n: number) => n.toFixed(1);

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
  return `M${f1(cx)} ${f1(cy)} Q${f1(mx + nx * width)} ${f1(my + ny * width)} ${f1(tx)} ${f1(ty)} Q${f1(mx - nx * width)} ${f1(my - ny * width)} ${f1(cx)} ${f1(cy)}Z`;
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
}
const FROND_ANGLES = [-170, -146, -122, -98, -74, -50, -26, -4, 16, 164];

function Palm({ x, h, lean, bend, fill, seed }: PalmSpec) {
  const base = 260;
  const cx = x + lean;
  const cy = base - h;
  const len = h * 0.27;
  return (
    <g fill={fill}>
      <path d={trunkPath(x, base, cx, cy, bend, 9, 5)} />
      {FROND_ANGLES.map((deg, i) => {
        const L = len * (0.75 + 0.5 * hash(i, seed, 9));
        const droop = L * 0.45 * (1 - Math.abs(Math.sin(rad(deg))));
        return <path key={deg} d={frondPath(cx, cy, deg, L, droop, L * 0.13)} />;
      })}
      <circle cx={cx - 3} cy={cy + 4} r="3" />
      <circle cx={cx + 3} cy={cy + 5} r="3" />
    </g>
  );
}

const LEFT_PALMS: PalmSpec[] = [
  { x: 100, h: 150, lean: 24, bend: -9, fill: '#3B1366', seed: 1 },
  { x: 44, h: 190, lean: 40, bend: -14, fill: '#240A42', seed: 2 },
  { x: 12, h: 120, lean: 20, bend: -7, fill: '#12041F', seed: 3 },
];
const RIGHT_PALMS: PalmSpec[] = [
  { x: 60, h: 140, lean: 26, bend: -10, fill: '#3B1366', seed: 4 },
  { x: 20, h: 180, lean: 36, bend: -12, fill: '#240A42', seed: 5 },
  { x: 92, h: 100, lean: 16, bend: -6, fill: '#12041F', seed: 6 },
];

function PalmCluster({ side }: { side: 'left' | 'right' }) {
  const palms = side === 'left' ? LEFT_PALMS : RIGHT_PALMS;
  return (
    <svg
      viewBox="0 0 160 260"
      preserveAspectRatio="xMinYMax meet"
      className={`absolute bottom-0 h-full w-[48%] ${side === 'left' ? 'left-0' : 'right-0'}`}
      style={{ overflow: 'visible', transform: side === 'right' ? 'scaleX(-1)' : undefined }}
    >
      {palms.map((p) => (
        <Palm key={p.seed} {...p} />
      ))}
    </svg>
  );
}

const CLOUDS = [
  { top: '16%', left: '6%', w: '38%', h: 5, c: '#FF7A59', o: 0.35 },
  { top: '24%', left: '52%', w: '42%', h: 6, c: '#FFB38A', o: 0.4 },
  { top: '34%', left: '18%', w: '30%', h: 4, c: '#FFD166', o: 0.45 },
  { top: '42%', left: '58%', w: '26%', h: 4, c: '#FFE3A3', o: 0.4 },
  { top: '52%', left: '2%', w: '34%', h: 3, c: '#FFD166', o: 0.5 },
];

function ViceSunset() {
  const uid = useId().replace(/:/g, '');
  const cuts: [number, number][] = [[110, 1.5], [119, 2.5], [128, 3.5], [137, 4.5], [146, 5.5]];
  return (
    <>
      {/* Langit senja */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(to bottom, #1E0B36 0%, #6B1D7B 24%, #E83E8C 46%, #FF7A59 66%, #FFD166 80%)',
        }}
      />
      {/* Pendar matahari */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 45% 70% at 50% 78%, rgba(255,209,102,.55), rgba(255,122,89,.25) 45%, transparent 70%)',
        }}
      />
      {/* Matahari dengan garis retro */}
      <div className="absolute bottom-[22%] left-1/2 h-[66%] -translate-x-1/2" style={{ aspectRatio: '4 / 3' }}>
        <svg viewBox="0 0 200 150" preserveAspectRatio="xMidYMax meet" className="h-full w-full">
          <defs>
            <linearGradient id={`${uid}-sun`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#FFD166" />
              <stop offset="0.5" stopColor="#FF7A59" />
              <stop offset="1" stopColor="#E83E8C" />
            </linearGradient>
            <mask id={`${uid}-cut`}>
              <rect width="200" height="150" fill="#fff" />
              {cuts.map(([y, h]) => (
                <rect key={y} x="0" y={y} width="200" height={h} fill="#000" />
              ))}
            </mask>
          </defs>
          <g mask={`url(#${uid}-cut)`}>
            <circle cx="100" cy="92" r="70" fill={`url(#${uid}-sun)`} />
          </g>
        </svg>
      </div>
      {/* Awan tipis */}
      {CLOUDS.map((c) => (
        <div
          key={c.top + c.left}
          className="absolute rounded-full"
          style={{
            top: c.top,
            left: c.left,
            width: c.w,
            height: c.h,
            opacity: c.o,
            filter: 'blur(1px)',
            background: `linear-gradient(90deg, transparent, ${c.c}, transparent)`,
          }}
        />
      ))}
      {/* Laut + pantulan matahari bergaris */}
      <div
        className="absolute inset-x-0 bottom-0 h-[22%]"
        style={{
          background:
            'repeating-linear-gradient(to bottom, rgba(30,11,54,0) 0 3px, rgba(30,11,54,.5) 3px 5px), radial-gradient(ellipse 22% 100% at 50% 0%, rgba(255,209,102,.7), rgba(255,122,89,0) 100%), linear-gradient(to bottom, #E83E8C 0%, #6B1D7B 55%, #1E0B36 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-[22%] h-px"
        style={{ background: 'linear-gradient(90deg, transparent, #FFD166, transparent)' }}
      />
      {/* Siluet palem berlapis */}
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