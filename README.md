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

1. **Private Circle (Invite-Only)** — buat/gabung grup eksklusif dengan kode unik 8 karakter, bebas dari penilaian publik, lengkap dengan manajemen anggota (Kick Member oleh Captain & Leave Circle).
2. **P2P Custom Quest & Bomb Mission** — kirim misi dadakan ke teman satu circle dengan taruhan koin (5–100 koin) & *Rank Points*, lengkap dengan target jarak, durasi, dan tenggat waktu.
3. **Perekaman GPS & Verifikasi Anti-Cheat Otomatis** — rute, jarak, *pace*, dan kalori secara *real-time*; verifikasi Haversine + deteksi anti-cheat server-side (kecepatan kendaraan bermotor, lompatan koordinat, & validasi rentang waktu).
4. **Live Group Run (Synchronous Session)** — host membuat room, anggota circle bergabung, posisi dikirim tiap 5 detik untuk *live leaderboard* & *distance gap* ("Dika unggul 200 m dari kamu").
5. **Share Social Track Map Card** — kartu PNG 1080×1920 bertema Neo-Brutalism berisi rute, metrik, status misi, serta QR & kode circle; dibagikan ke IG Story / WhatsApp via Web Share API.
6. **Coin Economy & Shield Pass** — top-up koin virtual tercatat di ledger transaksi; *Shield Ticket* untuk membatalkan penalti misi tanpa kehilangan Rank Points.
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
| **Backend** | NestJS 12, Passport JWT, `@nestjs/schedule` (cron kedaluwarsa quest), `class-validator`, `RateLimitGuard`, Security Headers & CORS |
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
│   │   │   ├── circle/                # CircleMembersSheet (daftar member, kick, leave)
│   │   │   ├── activity/              # GroupRunPanel, VerificationModal, LocationPrompt
│   │   │   └── share/                 # ShareCard, ShareCardModal, RouteSvg
│   │   ├── store/                     # AppContext, RunSession, ThemeContext, ToastContext
│   │   ├── services/                  # endpoints.ts, http.ts, groupRun.ts
│   │   ├── hooks/                     # useGeoTracker (GPS + sessionStorage), useGroupRun
│   │   ├── lib/                       # geo.ts, location.ts, shareCard.ts
│   │   ├── data/mock.ts               # Data fallback offline / demo
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
│   │   ├── common/guards/             # RateLimitGuard (proteksi brute-force & spam)
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

---

## Panduan Setup Lengkap (Step-by-Step)

Bagian ini menjelaskan langkah instalasi dan konfigurasi lengkap mulai dari *clone* repositori hingga aplikasi siap digunakan (baik mode *Quick Start* maupun setup database PostgreSQL/Supabase penuh).

### 1. Prasyarat Sistem
Pastikan perangkat Anda telah terinstal:
* **Node.js** versi **≥ 20.x** (`node -v`)
* **npm** versi **≥ 10.x** (`npm -v`)
* **Git** (`git --version`)
* **Database PostgreSQL** (bisa menggunakan [Supabase](https://supabase.com/) gratis atau PostgreSQL lokal). *Catatan: Jika database belum dikonfigurasi, frontend tetap dapat berjalan dalam mode Demo/Offline Fallback.*

### 2. Clone Repositori & Instal Dependensi
Jalankan perintah berikut dari terminal pada direktori kerja Anda:

```bash
git clone <url-repo-cidash>
cd CiDash

# Menginstal seluruh dependensi monorepo (root, frontend, dan backend)
# Sekaligus otomatis men-generate Prisma Client melalui script postinstall
npm install
```

### 3. Konfigurasi Environment Variables (`.env`)
Saat Anda menjalankan `npm run dev`, skrip `predev` akan otomatis menyalin `.env.example` menjadi `.env` jika belum ada. Namun untuk konfigurasi manual atau kustomisasi database, siapkan dua file berikut:

#### A. Backend (`backend/.env`)
Salin dari `backend/.env.example`:
```env
# Koneksi PostgreSQL / Supabase Transaction Pooler (Port 6543 / 5432)
DATABASE_URL="postgresql://username:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres?pgbouncer=true"

# Koneksi Direct PostgreSQL untuk Migrasi Prisma (Port 5432)
DIRECT_URL="postgresql://username:password@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres"

# Konfigurasi JWT (Wajib diisi dengan string acak minimal 16 karakter)
JWT_SECRET="cidash_super_secret_jwt_key_2026_secured"
JWT_EXPIRES_IN="7d"

# Daftar origin frontend yang diizinkan mengakses API (pisahkan dengan koma)
CORS_ORIGIN="http://localhost:5173,http://127.0.0.1:5173"

# (Opsional) Secret header untuk endpoint manual cron expire check
CRON_SECRET=""

# Port Server Backend
PORT=3000
```

#### B. Frontend (`frontend/.env`)
Salin dari `frontend/.env.example`:
```env
# Base URL REST API Backend NestJS
VITE_API_BASE_URL="http://localhost:3000"

# (Opsional) Supabase Realtime untuk Group Run
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""
```

### 4. Inisialisasi Database & Seed Data Demo (PostgreSQL / Supabase)
Jika `DATABASE_URL` sudah mengarah ke database PostgreSQL yang aktif:

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Terapkan skema tabel ke database PostgreSQL
npm run db:push

# 3. Isi database dengan akun demo, circle RUN8MORN, aktivitas, dan misi awal
npm run seed --workspace backend
```

### 5. Menjalankan Aplikasi (Development)
Jalankan Backend dan Frontend secara bersamaan dari **root** proyek:

```bash
npm run dev
```

Layanan akan aktif di:
* **Frontend (React PWA):** `http://localhost:5173`
* **Backend (NestJS API):** `http://localhost:3000`

### 6. Build untuk Produksi & Pengujian
```bash
# Type-check TypeScript frontend
npm run typecheck

# Build produksi (frontend/dist & backend/dist)
npm run build

# Menjalankan backend hasil build produksi
npm run start:prod --workspace backend
```

### 7. Akun Demo Siap Pakai (Hasil `seed.ts`)
Jika database sudah di-*seed*, Anda dapat login menggunakan password **`password123`** (atau cukup klik tombol **"Continue with Demo Account (Budi)"** di halaman Login):

| Nama | Email | Peran di Circle `RUN8MORN` | Saldo Koin | Rank Points | Shield Ticket |
| :--- | :--- | :--- | :---: | :---: | :---: |
| **Budi Santoso** | `budi@cidash.id` | Member | 120 | 350 RP | 1 |
| **Nicholas (Captain)** | `captain@cidash.id` | Captain | 250 | 480 RP | 2 |
| **Siti Rahma** | `siti@cidash.id` | Member | 80 | 420 RP | 0 |
| **Reza Pratama** | `reza@cidash.id` | Member | 50 | 290 RP | 1 |

---

## Skenario Demo Lengkap (Apa Saja yang Bisa Didemokan)

Berikut adalah alur fitur yang siap Anda demonstrasikan secara *end-to-end*:

1. **One-Click Demo Login & Multi-Circle Onboarding (`/login`)**
   * Klik **"Continue with Demo Account (Budi)"** untuk langsung masuk tanpa mengetik kredensial, atau daftar akun baru lewat tab **Sign up**.
   * Buat Circle baru (otomatis mendapat kode unik 8 karakter & menjadi **Captain**) atau gabung ke Circle teman dengan kode `RUN8MORN`.
2. **Manajemen Circle & Papan Peringkat (`/dashboard`)**
   * Ganti Circle aktif melalui *Circle Switcher* di bagian atas Dashboard.
   * Klik jumlah anggota (`members`) untuk membuka **Circle Members Sheet**: lihat status teman yang sedang berlari *live*, salin/bagikan kode undangan, **Kick anggota** (jika login sebagai Captain), atau **Leave Circle**.
3. **Top-Up Koin Demo & Kirim P2P Bomb Mission (`/profile` & `/custom-quest`)**
   * Klik ikon koin di pojok kanan atas untuk membuka **Wallet Top-Up (Demo)** dan tambahkan koin secara instan.
   * Buka tab **Quests** → klik **Send a Bomb Mission**: pilih teman satu Circle, pilih jenis olahraga (*Run* / *Ride*), target jarak, batas waktu, dan geser slider taruhan koin (`5–100` koin).
4. **Terima Tantangan atau Gunakan Shield Ticket (`/custom-quest`)**
   * Di tab **Received**, Anda dapat menekan **Accept & start** untuk langsung mengerjakan misi, atau menekan **Shield / Decline** untuk melihat konfirmasi penggunaan *Shield Ticket* (menolak misi dengan **0 penalti RP**) maupun penalti poin jika tidak memiliki tiket.
5. **Simulasi GPS Desktop & Verifikasi Anti-Cheat (`/activity`)**
   * Buka tab **Activity**, aktifkan saklar **Simulation mode (Demo)** agar peta bergerak otomatis tanpa perlu keluar ruangan.
   * Tekan **Start**, pantau peta Leaflet, jarak, durasi, pace, dan kalori secara *real-time* (coba pindah tab—indikator titik merah di navigasi bawah menunjukkan perekaman tetap berjalan, dan sesi aman meskipun browser di-*refresh*).
   * Tekan **Finish** → konfirmasi **Finish & verify** untuk melihat modal verifikasi Anti-Cheat dan perolehan Rank Points.
6. **Live Group Run (`/activity?mode=group`)**
   * Pilih mode **Group run** untuk bergabung ke room *live* yang sedang berjalan atau membuat lobby baru bersama anggota Circle dan melihat *live leaderboard* antar peserta setiap 5 detik.
7. **Ekspor & Bagikan Social Track Map Card (IG Story 1080×1920)**
   * Setelah menyelesaikan olahraga (atau dari daftar **Activity history** di halaman **Profile**), klik tombol **Share card** untuk men-generate gambar PNG rute lari lengkap dengan statistik dan QR Code undangan Circle.

---

## Panduan Branching & Commit (Git Best Practices)

### 1. Aturan Penamaan Branch

Format: `<tipe>/<nama-singkat-fitur>` (huruf kecil, pemisah `-`):

| Tipe Branch | Tujuan Penggunaan | Contoh Penamaan |
| :--- | :--- | :--- |
| `feat/` | Pengembangan fitur baru | `feat/squad-invite-code`, `feat/fe-be-integration` |
| `fix/` | Perbaikan bug atau error | `fix/security-and-usability`, `fix/gps-haversine-calc` |
| `docs/` | Perubahan dokumentasi | `docs/setup-and-demo-guide`, `docs/update-progress` |
| `refactor/` | Perapihan kode tanpa mengubah fungsi | `refactor/prisma-service`, `refactor/app-context` |
| `test/` | Unit test / e2e | `test/auth-controller`, `test/geo-utils` |
| `chore/` | Dependensi, konfigurasi, build tool | `chore/zero-setup-dev`, `chore/setup-eslint` |

### 2. Standar Pesan Commit (*Conventional Commits*)

Struktur: `<tipe>(<lingkup>): <deskripsi singkat>`.

* **Contoh:**
  * `fix(security): harden jwt secret, rate limiting, cors, and anti-cheat validation`
  * `feat(ux): add shield ticket actions, circle member management, and workout finish confirmation`
  * `docs(readme): add complete step-by-step setup and demo guide`

---

## Referensi Dokumen
* **Spesifikasi Teknis & Business Model Canvas:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](docs/SPESIFIKASI_PROYEK_CIDASH.md)
* **Checklist Progres & Roadmap:** [docs/CHECKLIST_PROGRES_PROYEK.md](docs/CHECKLIST_PROGRES_PROYEK.md)
* **Koleksi & Test API:** [docs/api/](docs/api/)
* **Detail frontend (struktur, deep-link, integrasi):** [frontend/README.md](frontend/README.md)
* **Detail backend:** [backend/README.md](backend/README.md)
