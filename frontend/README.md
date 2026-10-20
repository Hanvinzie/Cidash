# Cidash Frontend (React PWA)

Progressive Web App untuk Cidash, dibangun dengan **React + TypeScript + Tailwind CSS + Vite** dan dukungan PWA (`vite-plugin-pwa`), serta sudah terintegrasi penuh dengan REST API Backend NestJS.

## Menjalankan

Dari root monorepo:
```bash
npm install
npm run dev      # Frontend: http://localhost:5173 | Backend: http://localhost:3000
```

## Build Produksi

```bash
npm run build:frontend    # output ke frontend/dist/
npm run preview --workspace frontend  # pratinjau hasil build PWA
```

## Struktur

```
frontend/
├── public/                 # Aset statis + ikon PWA
├── src/
│   ├── components/
│   │   ├── ui/             # Button, Card, Badge, Field, Modal, dll
│   │   ├── layout/         # AppLayout + bottom navigation
│   │   ├── routing/        # ProtectedRoute (auth guard)
│   │   ├── map/            # RouteMap (Leaflet, lazy-loaded)
│   │   ├── activity/       # GroupRunPanel, VerificationModal
│   │   └── share/          # ShareCard (Neo-Brutalism), ShareCardModal, RouteSvg
│   ├── screens/            # 5 halaman: Login, Dashboard, CustomQuest, Activity, Profile
│   ├── store/AppContext.tsx # State global terhubung ke REST API Backend (+ fallback offline)
│   ├── services/
│   │   ├── endpoints.ts    # Kontrak REST FE↔BE ([ADA] semua terhubung)
│   │   ├── http.ts         # HTTP client + JWT tokenStore
│   │   └── groupRun.ts     # Interface transport realtime + implementasi room
│   ├── hooks/              # useGeoTracker (GPS + Mode Simulasi), useGroupRun (room + progress 5 dtk)
│   ├── lib/                # geo.ts (Haversine, pace), shareCard.ts (PNG + Web Share)
│   ├── data/mock.ts        # Data fallback saat offline
│   ├── types/              # Tipe domain
│   ├── routes.ts           # Path & deep-link antar-halaman
│   ├── App.tsx             # Routing (lazy per halaman)
│   └── main.tsx            # Entry + registrasi service worker
└── vite.config.ts          # Vite + manifest PWA
```

## Alur & Deep-link

| Dari | Aksi | Ke |
| --- | --- | --- |
| Login | Auth (`/auth/login` atau `/auth/register`) → pilih/buat/gabung circle | `/dashboard` (atau halaman asal) |
| Dashboard | "Start" misi grup | `/activity?mission=<id>` |
| Custom Quest | "Accept & start" bomb mission (`/quests/:id/accept`) | `/activity?mission=<id>` |
| Custom Quest | Top Up | `/profile?topup=1` |
| Activity | Finish (`POST /activities`) → pop-up verifikasi | `/dashboard` |
| Profile | Klik circle / "+ Create / join" | `/dashboard` / `/login?step=circle` |
| Dashboard | Banner Group Run "Join" / "Host" | `/activity?mode=group&room=<id>` |
| Activity / Profile | "Share Card" → scan QR di kartu | `/login?step=circle&code=<8-char>` |

## Integrasi Backend

1. **REST API (`store/AppContext.tsx` & `services/http.ts`)** — Seluruh aksi utama (Auth, Create/Join Circle, Leaderboard, Send/Accept/Reject Bomb Mission, Record GPS Activity, History Rute GeoJSON, dan Top-Up Koin) sudah memanggil endpoint NestJS secara langsung dengan Bearer Token JWT.
2. **Peta & GPS (`hooks/useGeoTracker.ts` & `components/map/RouteMap.tsx`)** — Mendukung pelacakan GPS perangkat asli (`navigator.geolocation.watchPosition`) maupun **Simulation mode** untuk pengujian langsung di laptop/desktop.
3. **Share Card (`components/share/ShareCard.tsx`)** — Mengonversi rute `routeGeoJson` dari backend menjadi siluet SVG + QR Code undangan Circle dalam format PNG 1080×1920.
