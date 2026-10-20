# CIDASH
> **Social Gamified Fitness Tracker berbasis Pertemanan Privat (Invite-Only)**

[![React PWA](https://img.shields.io/badge/Frontend-React%20PWA-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite%205-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind](https://img.shields.io/badge/UI-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Leaflet](https://img.shields.io/badge/Map-Leaflet-199900?logo=leaflet&logoColor=white)](https://leafletjs.com/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-ea2845?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%205-2D3748?logo=prisma&logoColor=white)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-336791?logo=postgresql&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](#)

---

## Ringkasan Proyek

**Cidash** adalah aplikasi kebugaran interaktif yang dirancang khusus untuk mengatasi rasa canggung (*social anxiety*) berolahraga di platform sosial publik. Dengan Cidash, pengguna dapat berolahraga kasual bersama lingkaran pertemanan terpercaya menggunakan sistem **Circle Kode 8 Karakter**, berlari bersama secara *live* lewat **Group Run**, saling menantang dengan mekanisme **P2P Bomb Mission** berbayar koin, serta bersaing secara sportif dengan **Season Reset berkala (3 bulan)**.

Dokumentasi lengkap:
* **[Spesifikasi Lengkap Proyek](docs/SPESIFIKASI_PROYEK_CIDASH.md)**
* **[Checklist Progres & Roadmap](docs/CHECKLIST_PROGRES_PROYEK.md)**
* **[Koleksi & Test API (Postman / .http)](docs/api/)**

---

## Fitur Utama

1. **Private Circle (Invite-Only)** — buat/gabung grup eksklusif dengan kode unik 8 karakter, bebas dari penilaian publik.
2. **P2P Custom Quest & Bomb Mission** — kirim misi dadakan ke teman satu circle dengan taruhan koin & *Rank Points*, lengkap dengan target jarak, durasi, dan tenggat waktu.
3. **Perekaman GPS & Verifikasi Otomatis** — rute, jarak, *pace*, dan kalori secara *real-time*; verifikasi Haversine + deteksi anti-cheat (kecepatan kendaraan bermotor / manipulasi koordinat).
4. **Live Group Run (Synchronous Session)** — host membuat room, anggota circle bergabung, posisi dikirim tiap 5 detik untuk *live leaderboard* & *distance gap* ("Daffa unggul 200 m dari kamu").
5. **Share Social Track Map Card** — kartu PNG 1080×1920 bertema Neo-Brutalism berisi rute, metrik, status misi, serta QR & kode circle; dibagikan ke IG Story / WhatsApp via Web Share API.
6. **Coin Economy & Shield Pass** — top-up koin virtual tercatat di ledger transaksi; *Shield Ticket* untuk membatalkan penalti misi.
7. **Papan Peringkat & Season Reset (3 Bulan)** — reset peringkat per kuartal agar motivasi seluruh anggota tetap tinggi.

---

## Panduan Warna & Tipografi (Color Guide)

UI memakai **design token** berbasis CSS variable (`frontend/src/index.css`) yang dipetakan ke class Tailwind (`frontend/tailwind.config.js`). Satu class — misalnya `bg-surface` atau `text-muted` — otomatis berganti nilai di **light** dan **dark mode**. Jangan pakai warna hardcoded (`slate-*`, `#hex`) di komponen; gunakan token di bawah.

**Font:** [Plus Jakarta Sans](https://fonts.google.com/specimen/Plus+Jakarta+Sans) (variable, self-hosted via `@fontsource-variable/plus-jakarta-sans` agar tetap jalan offline sebagai PWA). Bobot: 400 body · 600 label · 700 judul kartu · 800 judul halaman & angka metrik.

### Brand

| Token (class) | Light | Dark | Pemakaian |
| :--- | :--- | :--- | :--- |
| `cidash-primary` | `#EA2845` | `#EA2845` | Warna utama: tombol utama, nav aktif, progress, aksen |
| `cidash-primary-hover` | `#C81E3A` | `#F24A63` | Hover / pressed tombol utama |
| `cidash-on-primary` | `#FFFFFF` | `#FFFFFF` | Teks & ikon di atas warna merah |

Gradien kartu saldo koin: `#EA2845 → #B3122E`.

### Netral (permukaan & teks)

| Token (class) | Light | Dark | Pemakaian |
| :--- | :--- | :--- | :--- |
| `canvas` | `#F6F6F8` | `#0B0F17` | Latar belakang halaman |
| `surface` | `#FFFFFF` | `#151B26` | Kartu, modal, bottom nav |
| `inset` | `#F1F2F5` | `#1E2634` | Input, segmented control, blok statistik di dalam kartu |
| `line` | `#E4E6EB` | `#2A3344` | Border & divider |
| `ink` | `#111827` | `#F8FAFC` | Teks utama |
| `muted` | `#4B5563` | `#A8B3C4` | Teks sekunder, label |
| `subtle` | `#6B7280` | `#7A879C` | Caption, placeholder, ikon nonaktif |

### Status

| Token (class) | Light | Dark | Pemakaian |
| :--- | :--- | :--- | :--- |
| `success` | `#059669` | `#34D399` | Misi selesai, reward RP |
| `warning` | `#D97706` | `#FBBF24` | Koin, status pending |
| `danger` | `#DC2626` | `#F87171` | Gagal, penalti, LIVE, sign out |

Badge/latar lembut memakai opacity: `bg-success/15 text-success`, `bg-cidash-primary/10 text-cidash-primary`.

### Pengecualian

**Share Card** (`components/share/ShareCard.tsx`) memakai warna brand tetap: gradien merah `#EA2845 → #B3122E`, teks putih, panel undangan putih dengan kode circle merah. Warnanya tidak ikut light/dark mode, jadi PNG yang dibagikan (1080×1920) selalu sama.

### Tema

- Default mengikuti pengaturan OS (`prefers-color-scheme`). User bisa memilih **Light / Dark / System** di *Profile → Appearance*, atau lewat tombol matahari/bulan di top bar.
- Pilihan disimpan di `localStorage` (`cidash_theme`) dan diterapkan lewat class `dark` di `<html>`. Skrip kecil di `index.html` menerapkannya sebelum render supaya tidak berkedip.
- Logika ada di `store/ThemeContext.tsx` (`useTheme()`).

---

## Arsitektur

### Tech Stack

| Lapisan | Teknologi |
| :--- | :--- |
| **Frontend (PWA)** | React 18, TypeScript, Vite 5, Tailwind CSS 3 (light/dark token), Plus Jakarta Sans, React Router 6, `vite-plugin-pwa` (manifest + service worker) |
| **Peta & GPS** | Geolocation API + Mode Simulasi Desktop, Leaflet + React-Leaflet (OpenStreetMap), Haversine di `lib/geo.ts` |
| **Share Card** | `html-to-image`, `qrcode.react`, Web Share API |
| **Backend** | NestJS 12, Passport JWT, `@nestjs/schedule` (cron kedaluwarsa quest), class-validator, CORS enabled |
| **Database** | PostgreSQL / Supabase via Prisma 5 (dengan mode *graceful fallback* jika DB offline) |
| **Monorepo** | npm workspaces + `concurrently` + auto `.env` bootstrapper (`predev`) |

### Alur Data

```
React PWA ──REST (JWT)──► NestJS API ──Prisma──► PostgreSQL (Supabase)
    │                         ▲
    └──Realtime channel───────┘   group_run:<room_id>  (progress tiap 5 detik → broadcast state)
```

### Struktur Proyek (Monorepo)

```
Cidash/
├── .github/
│   └── PULL_REQUEST_TEMPLATE.md
├── frontend/                          # React PWA
│   ├── public/                        # Ikon PWA, favicon, robots.txt
│   ├── src/
│   │   ├── screens/                   # Login, Dashboard, CustomQuest, Activity, Profile
│   │   ├── components/
│   │   │   ├── ui/                    # Button, Card, Badge, Field, Modal, CoinBalance, dll
│   │   │   ├── layout/                # AppLayout + bottom navigation
│   │   │   ├── routing/               # ProtectedRoute (auth guard)
│   │   │   ├── map/                   # RouteMap (Leaflet, lazy-loaded)
│   │   │   ├── activity/              # GroupRunPanel, VerificationModal
│   │   │   └── share/                 # ShareCard, ShareCardModal, RouteSvg
│   │   ├── store/AppContext.tsx       # State global terintegrasi REST API Backend + fallback
│   │   ├── services/
│   │   │   ├── endpoints.ts           # Kontrak REST FE ↔ BE
│   │   │   ├── http.ts                # HTTP client + JWT tokenStore
│   │   │   └── groupRun.ts            # Interface transport realtime + implementasi room
│   │   ├── hooks/                     # useGeoTracker (GPS + Simulasi), useGroupRun
│   │   ├── lib/                       # geo.ts (Haversine, pace), shareCard.ts (PNG + share)
│   │   ├── data/mock.ts               # Data fallback offline
│   │   ├── types/                     # Tipe domain
│   │   ├── routes.ts                  # Path & deep-link antar-halaman
│   │   └── App.tsx / main.tsx
│   ├── vite.config.ts                 # Vite + manifest PWA
│   └── package.json
├── backend/                           # NestJS REST API
│   ├── src/
│   │   ├── auth/                      # Register, login, top-up koin, JWT guard, /auth/me
│   │   ├── squads/                    # Circle: buat, join kode, leaderboard (+km), leave, kick
│   │   ├── quests/                    # Bomb Mission: buat, accept, reject, shield, cron expire
│   │   ├── activities/                # Rekam aktivitas + AntiCheatService, riwayat (+routeGeoJson), detail
│   │   ├── database/                  # PrismaService (auto-connect & graceful fallback)
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   ├── schema.prisma              # User, Squad, Activity, Quest, PointLedger, CoinTransaction
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── test/                          # E2E testing
│   └── package.json
├── docs/
│   ├── SPESIFIKASI_PROYEK_CIDASH.md
│   ├── CHECKLIST_PROGRES_PROYEK.md
│   └── api/                           # CiDash.postman_collection.json, api-test.http
├── .gitignore
├── package.json                       # Root workspace + script gabungan
└── README.md
```

> **Catatan istilah:** *Circle* di UI = *Squad* di backend.

### Halaman & Navigasi

| Halaman | Path | Isi Utama |
| :--- | :--- | :--- |
| Login & Onboarding | `/login` | Auth (Sign in / Sign up / Demo Account), Create Circle, Join Circle (kode 8 karakter) |
| Home | `/dashboard` | Sapaan, circle switcher + share kode, statistik, quick start Solo/Group Run, misi circle, leaderboard |
| Quests | `/custom-quest` | Saldo koin, form Bomb Mission, tab Received / Sent (Accept / Decline) |
| Activity | `/activity` | Mode Solo / Group Run, pilih misi, peta + metrik real-time, Mode Simulasi GPS, verifikasi Anti-Cheat, Share Card |
| Profile | `/profile` | Identitas & statistik, dompet & top-up koin, riwayat + galeri rute SVG, circle, Appearance (tema), sign out |

### Status Integrasi Frontend ↔ Backend

Frontend (`AppContext.tsx`) **sudah terhubung penuh** dengan REST API Backend NestJS (`http.ts`):

1. **Autentikasi & Dompet (`/auth/*`):** `POST /auth/login`, `POST /auth/register` (starter 60 koin & 1 shield ticket), `GET /auth/me`, dan `POST /auth/top-up` (mencatat `CoinTransaction`).
2. **Circle / Squad (`/squads/*`):** `POST /squads`, `POST /squads/join`, `GET /squads/my`, dan `GET /squads/:id/leaderboard` (lengkap dengan akumulasi `totalDistanceKm` tiap member).
3. **Bomb Mission (`/quests/*`):** `POST /quests` (memotong koin & membuat tantangan), `GET /quests/active`, `POST /quests/:id/accept`, `POST /quests/:id/reject` (otomatis memakai *Shield Ticket* jika ada, atau mencatat penalti/kemenangan di `PointLedger`), dan `POST /quests/:id/shield`.
4. **Aktivitas & Peta (`/activities/*`):** `POST /activities` (verifikasi Haversine & Anti-Cheat, auto-complete quest yang cocok, tambah Rank Points) dan `GET /activities/history` (menyertakan `routeGeoJson` untuk render ulang siluet rute di **Share Card**).

---

## Memulai (Quick Start — Zero Setup)

Prasyarat: **Node.js ≥ 20**. Semua perintah dijalankan dari **root** repositori.

### 1. Instal dependensi
```bash
npm install          # frontend + backend; Prisma Client otomatis di-generate (postinstall)
```

### 2. Jalankan aplikasi langsung
```bash
npm run dev          # otomatis membuat .env jika belum ada, lalu menyalakan Backend (:3000) & Frontend (:5173)
```
Ketika dijalankan, terminal akan menampilkan tautan yang bisa langsung di-**Ctrl + Klik**:
* **Frontend (Web App):** `http://localhost:5173`
* **Backend (REST API):** `http://localhost:3000`

### 3. Akun Demo Siap Pakai (Hasil `seed.ts`)
Jika menggunakan database yang sudah di-*seed* (`npm run seed --workspace backend`), Anda dapat langsung masuk dengan password **`password123`**:

| Nama | Email | Peran di Circle `RUN8MORN` | Saldo Koin | Rank Points |
| :--- | :--- | :--- | :---: | :---: |
| **Budi Santoso** | `budi@cidash.id` | Member | 120 | 350 RP |
| **Nicholas (Captain)** | `captain@cidash.id` | Captain | 250 | 480 RP |
| **Siti Rahma** | `siti@cidash.id` | Member | 80 | 420 RP |
| **Reza Pratama** | `reza@cidash.id` | Member | 50 | 290 RP |

### Daftar Script Root

| Script | Fungsi |
| :--- | :--- |
| `npm run dev` | Menyiapkan `.env` otomatis + menjalankan Frontend & Backend bersamaan (`concurrently`) |
| `npm run dev:frontend` / `dev:backend` | Menjalankan salah satu layanan saja |
| `npm run build` | Build frontend (`frontend/dist`) + backend (`backend/dist`) |
| `npm run typecheck` | Type-check TypeScript frontend |
| `npm run prisma:generate` | Generate ulang Prisma Client setelah `schema.prisma` berubah |
| `npm run db:push` | Sinkronkan skema Prisma ke database PostgreSQL |

---

## Panduan Branching & Commit (Git Best Practices)

### 1. Aturan Penamaan Branch

Format: `<tipe>/<nama-singkat-fitur>` (huruf kecil, pemisah `-`):

| Tipe Branch | Tujuan Penggunaan | Contoh Penamaan |
| :--- | :--- | :--- |
| `feat/` | Pengembangan fitur baru | `feat/squad-invite-code`, `feat/fe-be-integration` |
| `fix/` | Perbaikan bug atau error | `fix/gps-haversine-calc`, `fix/auth-demo-credentials` |
| `docs/` | Perubahan dokumentasi | `docs/api-specification`, `docs/update-progress` |
| `refactor/` | Perapihan kode tanpa mengubah fungsi | `refactor/prisma-service`, `refactor/app-context` |
| `test/` | Unit test / e2e | `test/auth-controller`, `test/geo-utils` |
| `chore/` | Dependensi, konfigurasi, build tool | `chore/zero-setup-dev`, `chore/setup-eslint` |

### 2. Standar Pesan Commit (*Conventional Commits*)

Struktur: `<tipe>(<lingkup>): <deskripsi singkat>`.

* **Contoh:**
  * `chore(dev): add zero-setup env bootstrapper and clickable localhost banner`
  * `feat(backend): add coin top-up, quest reject endpoint, and leaderboard distance`
  * `feat(frontend): connect AppContext, Login, and GPS tracker to NestJS backend`
  * `docs(readme): update project progress and integration documentation`

---

## Referensi Dokumen
* **Spesifikasi Teknis & Business Model Canvas:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](docs/SPESIFIKASI_PROYEK_CIDASH.md)
* **Checklist Progres & Roadmap:** [docs/CHECKLIST_PROGRES_PROYEK.md](docs/CHECKLIST_PROGRES_PROYEK.md)
* **Koleksi & Test API:** [docs/api/](docs/api/)
* **Detail frontend (struktur, deep-link, integrasi):** [frontend/README.md](frontend/README.md)
* **Detail backend:** [backend/README.md](backend/README.md)
