# Cidash Frontend (React PWA)

Progressive Web App untuk Cidash, dibangun dengan **React + TypeScript + Tailwind CSS + Vite** dan dukungan PWA (`vite-plugin-pwa`).

## Menjalankan

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build Produksi

```bash
npm run build    # output ke dist/
npm run preview  # pratinjau hasil build
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
│   ├── store/AppContext.tsx # State global + titik integrasi API (TODO)
│   ├── services/
│   │   ├── endpoints.ts    # Kontrak REST FE↔BE ([ADA] / [BELUM] di backend)
│   │   ├── http.ts         # HTTP client + JWT (siap dipakai saat integrasi)
│   │   └── groupRun.ts     # Interface transport realtime + implementasi mock
│   ├── hooks/              # useGeoTracker (GPS), useGroupRun (room + progress 5 dtk)
│   ├── lib/                # geo.ts (Haversine, pace), shareCard.ts (PNG + Web Share)
│   ├── data/mock.ts        # Data awal prototype
│   ├── types/              # Tipe domain
│   ├── routes.ts           # Path & deep-link antar-halaman
│   ├── App.tsx             # Routing (lazy per halaman)
│   └── main.tsx            # Entry + registrasi service worker
└── vite.config.ts          # Vite + manifest PWA
```

## Alur & Deep-link

| Dari | Aksi | Ke |
| --- | --- | --- |
| Login | Auth → pilih/buat/gabung circle | `/dashboard` (atau halaman asal) |
| Dashboard | "Kerjakan" misi grup | `/activity?mission=<id>` |
| Custom Quest | "Terima & Mulai" bomb mission | `/activity?mission=<id>` |
| Custom Quest | Top Up | `/profile?topup=1` |
| Activity | Stop → pop-up verifikasi | `/dashboard` |
| Profile | Klik circle / "+ Buat / Gabung" | `/dashboard` / `/login?step=circle` |
| Dashboard | Banner Group Run "Gabung" / "Buat Room" | `/activity?mode=group&room=<id>` |
| Activity / Profile | "Kartu Share" → scan QR di kartu | `/login?step=circle&code=<8-char>` |

## Integrasi Backend (langkah berikutnya)

1. **REST** — ganti isi aksi di `store/AppContext.tsx` (bertanda `TODO`) dengan panggilan `http()` dari `services/http.ts`. Daftar endpoint & statusnya ada di `services/endpoints.ts`.
2. **Group Run realtime** — implementasikan `GroupRunTransport` (Supabase Realtime atau WebSocket NestJS) lalu ganti export `groupRunTransport` di `services/groupRun.ts`. UI tidak perlu diubah.
3. **Share Card** — sepenuhnya di klien. Backend cukup menyertakan `route` (array titik GPS) di `GET /activities/history`.

## PWA

- **Web App Manifest** dan **Service Worker** di-generate otomatis oleh `vite-plugin-pwa` (strategi `autoUpdate`).
- Dapat di-"Install" dari browser mobile/desktop dan berjalan offline setelah kunjungan pertama.
- Service worker **nonaktif saat `npm run dev`** (agar cache tidak mengganggu HMR). Uji PWA dengan `npm run build && npm run preview`.
- GPS butuh HTTPS atau `localhost`. Di desktop, centang **Mode simulasi** di halaman Activity.
