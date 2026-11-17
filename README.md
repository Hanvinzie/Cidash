# CIDASH
> **Social Gamified Fitness Tracker berbasis Pertemanan Privat (Invite-Only)**

[![React PWA](https://img.shields.io/badge/Frontend-React%20PWA-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Build-Vite%205-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Tailwind](https://img.shields.io/badge/UI-Tailwind%20CSS-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![MapLibre](https://img.shields.io/badge/Map-MapLibre%20GL-396CB2?logo=maplibre&logoColor=white)](https://maplibre.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-ea2845?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%205-2D3748?logo=prisma&logoColor=white)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-336791?logo=postgresql&logoColor=white)](https://supabase.com/)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](#)

---

## Ringkasan Proyek

**Cidash** adalah aplikasi kebugaran interaktif yang dirancang khusus untuk mengatasi rasa canggung (*social anxiety*) berolahraga di platform sosial publik. Dengan Cidash, pengguna dapat berolahraga kasual bersama lingkaran pertemanan terpercaya menggunakan sistem **Circle Kode 8 Karakter**, berlari bersama secara *live* lewat **Group Run**, saling menantang dengan mekanisme **P2P Bomb Mission** berbayar koin yang dilengkapi **proteksi Anti-Spam & Non-Pay-to-Win Shield Economy**, serta bersaing secara sportif dengan **Season Reset berkala (3 bulan)**.

Dokumentasi lengkap:
* **[Spesifikasi Lengkap Proyek](docs/SPESIFIKASI_PROYEK_CIDASH.md)**
* **[Checklist Progres & Roadmap](docs/CHECKLIST_PROGRES_PROYEK.md)**
* **[Koleksi & Test API (Postman / .http)](docs/api/)**

---

## Fitur Utama

1. **Private Circle (Invite-Only · Free & Premium Capacity)** — buat/gabung grup eksklusif dengan kode unik 8 karakter, lengkap dengan batas kapasitas aman (**Free Tier: maks 5 anggota**, **Premium Tier: maks 25 anggota** demi menjaga performa *live* GPS & leaderboard), fitur upgrade Circle (`100 koin`), serta manajemen anggota (Kick Member oleh Captain & Leave Circle).
2. **P2P Custom Quest & Bomb Mission (Anti-Spam)** — kirim misi dadakan ke teman satu circle yang berstatus `Ready` dengan taruhan koin (`5–100` koin) & *Rank Points*, lengkap dengan proteksi maksimal 1 misi aktif per target (`In Mission`) dan status istirahat (`Rest Mode`).
3. **Balanced Coin Economy & Non-Pay-to-Win Shield Pass** — koin digunakan untuk mengirim tantangan, membeli *Shield Ticket* (dengan batas kepemilikan 2 tiket & harga mingguan bertingkat `25 → 50` koin), memperpanjang tenggat waktu misi **`+12 Jam (Snooze)`**, serta mengaktifkan kuota *Rest Mode* tambahan.
4. **Perekaman GPS & Verifikasi Anti-Cheat Otomatis** — rute, jarak, *pace*, dan kalori secara *real-time*; verifikasi Haversine + deteksi anti-cheat server-side (kecepatan kendaraan bermotor, lompatan koordinat, & validasi rentang waktu).
5. **Live Group Run (Synchronous Session)** — host membuat room, anggota circle bergabung, posisi dikirim tiap 5 detik untuk *live leaderboard* & *distance gap* ("Dika unggul 200 m dari kamu").
6. **Share Social Track Map Card** — kartu PNG 1080×1920 bertema Neo-Brutalism berisi rute, metrik, status misi, serta QR & kode circle; dibagikan ke IG Story / WhatsApp via Web Share API.
7. **Papan Peringkat & Season Reset (3 Bulan)** — reset peringkat per kuartal agar motivasi seluruh anggota tetap tinggi.

---

## Alur Bomb Mission, Status Ketersediaan & Ekonomi Koin Seimbang (Anti-Spam & Non-Pay-to-Win)

Untuk memastikan **Bomb Mission** tetap seru, masuk akal dikerjakan di tengah kesibukan harian, tidak bisa di-*spam*, dan **tidak menjadi Pay-to-Win**, Cidash menerapkan mekanisme keseimbangan berikut:

```mermaid
flowchart TD
    A["Pengirim (Spend 5–100 Coins)"] --> B{"Cek Status Target"}
    B -->|"IN_MISSION (Sedang ada 1 misi aktif)"| C["Diblokir Otomatis (Anti-Spam)"]
    B -->|"RESTING (Rest Mode 24 Jam)"| D["Diblokir (Target sedang istirahat)"]
    B -->|"AVAILABLE (Ready)"| E["Bomb Mission Terkirim (Status Target -> IN_MISSION)"]
    E --> F{"Pilihan Target"}
    F -->|"1. Accept & Selesaikan Olahraga (Gratis)"| G["Target +RP Taruhan + RP Jarak"]
    F -->|"2. Snooze +12 Jam (10 Koin, maks 1x/misi)"| H["Deadline +12 Jam (Tetap wajib olahraga)"]
    F -->|"3. Gunakan Shield Ticket (Beli 25/50 Koin, maks 2/minggu)"| I["0 Penalti RP Target + Refund 50% Koin ke Pengirim"]
    F -->|"4. Decline / Kedaluwarsa tanpa Shield"| J["Target -RP Penalti & Pengirim +RP Kemenangan"]
```

### 1. Status Ketersediaan Anggota (`AvailabilityStatus`)
| Status | Cara Aktif | Aturan Keseimbangan (Anti-Spam & Anti-Camping) |
| :--- | :--- | :--- |
| **`AVAILABLE` (Ready)** | Default | Siap menerima tantangan Bomb Mission dari anggota satu Circle. |
| **`IN_MISSION` (Busy)** | Otomatis saat memiliki **1 Bomb Mission aktif** (`PENDING` / `ACCEPTED`) | Mencegah *dogpiling* / *spam*: anggota lain tidak bisa menumpuk Bomb Mission baru sampai misi aktif selesai, ditolak, atau di-*shield*. |
| **`RESTING` (Rest Mode 24h)** | Diaktifkan manual oleh pengguna (`POST /auth/status`) saat cedera, sibuk bekerja, atau istirahat | **Mencegah #1 Leaderboard Camping:**<br>• **1x Rest Mode pertama tiap minggu:** **Gratis (0 Koin)** selama 24 jam.<br>• **Rest Mode ke-2 di minggu yang sama:** **15 Koin** selama 24 jam.<br>• **Batas Mingguan:** Maksimal **2x Rest Mode per minggu**.<br>• **Freeze Rule:** Selama berada di `RESTING`, pengguna tidak bisa diserang **dan** tidak bisa mengirim Bomb Mission ke orang lain. |

### 2. Sistem Koin & Shield Ticket (Non-Pay-to-Win)
Koin tetap menjadi bahan bakar utama ekonomi aplikasi tanpa mengizinkan pemain kaya membeli kemenangan instan:
* **Beli Shield Ticket dengan Harga Bertingkat & Kuota (`POST /auth/buy-shield`):**
  * **Batas Tas (*Inventory Cap*):** Maksimal memegang **2 Shield Ticket** pada satu waktu (`2/2`).
  * **Batas & Harga Mingguan (*Escalating Cost*):** Pembelian ke-1 minggu ini = **`25 Koin`**, pembelian ke-2 minggu ini = **`50 Koin`**, pembelian ke-3 dikunci hingga minggu berikutnya (maksimal 2 per minggu).
  * **Zero RP Gain:** Shield hanya menahan pengurangan poin (`0 RP`), tidak pernah memberikan tambahan Rank Points. Untuk naik peringkat, pengguna tetap wajib berlari/bersepeda.
* **50% Coin Refund ke Pengirim Saat Di-Shield (`POST /quests/:id/shield`):**
  * Jika target menggunakan *Shield Ticket* saat misi masih `PENDING`, **50% koin taruhan otomatis dikembalikan (`REFUND`) ke pengirim** sehingga koin pengirim tidak hangus sia-sia.
* **Perpanjangan Waktu / Snooze `+12 Jam` (`POST /quests/:id/snooze`):**
  * Sedang hujan atau lembur? Target dapat membayar **`10 Koin`** (maksimal **1x per misi**) untuk memperpanjang *deadline* misi selama **+12 jam**—tetap wajib berolahraga penuh tanpa kehilangan poin.

### 3. Kapasitas Anggota Circle: Free Tier vs. Premium Tier
Untuk memastikan sistem *Live Group Run* (broadcast koordinat setiap 5 detik) dan kueri *Season Leaderboard* tetap ringan serta bebas beban berlebih (*server-safe*), kapasitas anggota per Circle dibatasi secara terukur:

| Tier Circle | Kapasitas Maksimal | Cara Aktif / Upgrade | Alasan Teknis & Keseimbangan |
| :--- | :---: | :--- | :--- |
| **Free Circle** | **5 Anggota** | Default saat membuat Circle baru (`POST /squads`) | Ideal untuk geng pertemanan dekat; jika sudah `5/5`, kode undangan otomatis menolak anggota ke-6 hingga Circle di-*upgrade*. |
| **Premium Circle** | **25 Anggota** | Upgrade seharga **`100 Koin`** (`POST /squads/:id/upgrade`) | Membuka kapasitas untuk komunitas/tim kantor hingga **25 orang** (batas aman *hard-cap* agar sinkronisasi *realtime* Group Run & perhitungan rute tetap cepat dan stabil). |

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
| **Peta & GPS** | Geolocation API + Mode Simulasi Desktop, MapLibre GL (tile vector OpenFreeMap), Screen Wake Lock, kompas DeviceOrientation, buffer IndexedDB, Haversine di `lib/geo.ts`, Encoded Polyline (`lib/polyline.ts`) |
| **Live circle** | Supabase Realtime *Broadcast* (`@supabase/supabase-js`, opsional) |
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
│   │   │   ├── map/                   # RouteMap (MapLibre GL, lazy-loaded)
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
│   │   ├── auth/                      # Register, login, top-up koin, buy-shield, status rest/ready, /auth/me
│   │   ├── squads/                    # Circle: buat, join kode, leaderboard (+km & status), leave, kick
│   │   ├── quests/                    # Bomb Mission: buat, accept, reject, shield (+50% refund), snooze (+12h), cron expire
│   │   ├── activities/                # Rekam aktivitas (batch sync + finish) + AntiCheatService, riwayat (+encodedPolyline), detail
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

## Pelacakan GPS (Arsitektur)

Dirancang agar banyak pengguna aktif bersamaan tidak membebani database maupun layanan peta/geocoding pihak ketiga.

| Aturan | Implementasi |
| :--- | :--- |
| **Buffer lokal & filter jitter** | `hooks/useGeoTracker.ts`: sampel GPS paling sering 1x/detik, filter akurasi, lonjakan, Kalman, dan **jitter Haversine** (perpindahan < 3 m **dan** kecepatan ≈ 0 dibuang; titik awal dan akhir selalu disimpan). Titik lolos disimpan ke memori dan **IndexedDB** (`lib/trackStore.ts`) sehingga pulih setelah crash/offline. |
| **Batch sync** | `services/activitySync.ts`: delta titik dikirim sebagai **satu polyline** tiap **30 detik atau 15 titik** (yang lebih dulu) dan segera saat **Pause**. Gagal (sinyal buruk): titik tetap di buffer, dicoba lagi dengan *backoff*, dan otomatis digabung pada batch berikutnya. Server idempoten (`fromIndex`), jadi retry aman. |
| **Live circle** | `hooks/useLiveCircleChannel.ts`: Supabase Realtime **Broadcast** (`location_update`), maksimal 1x per 4 detik per pengguna. Tanpa `INSERT` atau `postgres_changes`. Opt-in di Settings (Group run selalu berbagi). |
| **1 baris per aktivitas** | `Activity.encodedPolyline` (Google Encoded Polyline, presisi 5, ±2 KB per 1.000 titik) + `startLat/Lng`, `endLat/Lng`, `elevationGain`, `locationLabel`. Batch pertama membuat baris draft (`status = RECORDING`), batch berikutnya meng-update baris yang sama, dan Finish menyelesaikannya (`COMPLETED`). Draft tidak masuk riwayat atau leaderboard. |
| **Peta & geocoding aman rate-limit** | MapLibre GL + tile vector OpenFreeMap (bukan `tile.openstreetmap.org`). Reverse geocoding **hanya sekali saat Finish** (`lib/geocode.ts` terkunci selama merekam), koordinat dibulatkan 3 desimal, di-cache lokal, dan ada label cadangan bila gagal. |

Endpoint: `PUT /activities/sessions/:id/sync`, `DELETE /activities/sessions/:id`, `POST /activities` (lihat `docs/api/api-test.http`).

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

# (Opsional) Live circle: Supabase Realtime Broadcast. Kosongkan untuk mematikan.
VITE_SUPABASE_URL=""
VITE_SUPABASE_ANON_KEY=""

# (Opsional) Style peta vector. Default OpenFreeMap (tanpa API key).
VITE_MAP_STYLE_URL=""
VITE_MAP_STYLE_URL_DARK=""

# (Opsional) Repo untuk daftar kontributor di About. Default N11ch/Cidash (upstream).
VITE_GITHUB_REPO=""
```

### 4. Inisialisasi Database & Seed Data Demo (PostgreSQL / Supabase)
Jika `DATABASE_URL` sudah mengarah ke database PostgreSQL yang aktif:

```bash
# 1. Generate Prisma Client
npm run prisma:generate

# 2. Terapkan skema tabel ke database PostgreSQL
npm run db:push
#    (database yang sudah berjalan: terapkan migrasi aditif
#     backend/prisma/migrations/20261117120000_activity_encoded_polyline/migration.sql,
#     kolom routeGeoJson lama dipertahankan sehingga data lama tetap terbaca)

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
   * Klik jumlah anggota (`members`) untuk membuka **Circle Members Sheet**: lihat status ketersediaan teman (`Ready`, `In Mission`, atau `Resting`), status lari *live*, salin/bagikan kode undangan, **Kick anggota** (jika login sebagai Captain), atau **Leave Circle**.
3. **Status Ketersediaan (`Rest Mode`), Pembelian Shield Ticket & Kirim Bomb Mission (`/custom-quest`)**
   * Di kartu bagian atas halaman **Quests**, demonstrasikan pengubahan **Bomb Mission Status** ke **Rest Mode 24h** (1x gratis/minggu, ke-2 seharga `15 koin`, maks 2x/minggu) untuk memproteksi diri saat sedang tidak bisa berolahraga.
   * Klik **Buy Shield** untuk membeli *Shield Ticket* menggunakan koin dengan harga berjenjang (`25 koin` untuk tiket ke-1 minggu ini, `50 koin` untuk tiket ke-2, maksimal kepemilikan `2/2` tiket agar bebas *Pay-to-Win*).
   * Klik **Send a Bomb Mission**: pilih teman satu Circle (sistem otomatis memberi label dan memblokir pengiriman ke anggota yang sedang `In Mission` atau `Resting`), atur olahraga (*Run* / *Ride*), jarak, waktu, dan geser slider taruhan koin (`5–100` koin).
4. **Terima Tantangan, Snooze `+12 Jam`, atau Gunakan Shield Ticket (`/custom-quest`)**
   * Di tab **Received**, Anda memiliki 3 opsi seimbang:
     1. Tekan **Accept & start** untuk langsung mengerjakan misi.
     2. Tekan **`+12h (10c)`** untuk memperpanjang tenggat waktu misi selama 12 jam dengan 10 koin (maks 1x per misi).
     3. Tekan **Shield / Decline** untuk memblokir misi dengan *Shield Ticket* (**0 penalti RP** & otomatis mengembalikan **50% koin** ke pengirim) atau menolak dengan penalti poin jika tidak memiliki tiket.
5. **Simulasi GPS Desktop & Verifikasi Anti-Cheat (`/activity`)**
   * Aktifkan **Demo mode** di **Profile → Settings → Activity & location** agar GPS bergerak otomatis tanpa perlu keluar ruangan.
   * Buka tab **Activity**, tekan **Start**: peta vector tampil **layar penuh** (menutup navigasi), berputar mengikuti arah gerak dan layar tetap menyala. Hanya tombol **Pause** yang tampil; saat dijeda muncul **Resume** dan **Finish**. Sesi aman meskipun browser di-*refresh* (dipulihkan dari IndexedDB dalam status Paused).
   * Tekan **Finish** → konfirmasi **Finish & verify** untuk melihat modal verifikasi Anti-Cheat dan perolehan Rank Points. Nama lokasi aktivitas dicari satu kali di langkah ini.
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
