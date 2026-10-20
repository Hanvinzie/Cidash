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
**[Spesifikasi Lengkap Proyek](docs/SPESIFIKASI_PROYEK_CIDASH.md)**
**[Checklist Progres & Roadmap](docs/CHECKLIST_PROGRES_PROYEK.md)**
**[Koleksi & Test API (Postman / .http)](docs/api/)**

---

## Fitur Utama

1. **Private Circle (Invite-Only)** — buat/gabung grup eksklusif dengan kode unik 8 karakter, bebas dari penilaian publik.
2. **P2P Custom Quest & Bomb Mission** — kirim misi dadakan ke teman satu circle dengan taruhan koin & *Rank Points*, lengkap dengan target jarak, durasi, dan tenggat waktu.
3. **Perekaman GPS & Verifikasi Otomatis** — rute, jarak, *pace*, dan kalori secara *real-time*; verifikasi Haversine + deteksi anti-cheat (kecepatan kendaraan bermotor / manipulasi koordinat).
4. **Live Group Run (Synchronous Session)** — host membuat room, anggota circle bergabung, posisi dikirim tiap 5 detik untuk *live leaderboard* & *distance gap* ("Daffa unggul 200 m dari kamu").
5. **Share Social Track Map Card** — kartu PNG 1080×1920 bertema Neo-Brutalism berisi rute, metrik, status misi, serta QR & kode circle; dibagikan ke IG Story / WhatsApp via Web Share API.
6. **Coin Economy & Shield Pass** — beli koin via payment gateway (Midtrans / Xendit); *Shield Ticket* untuk membatalkan penalti misi.
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
| **Peta & GPS** | Geolocation API, Leaflet + React-Leaflet (OpenStreetMap), Haversine di `lib/geo.ts` |
| **Share Card** | `html-to-image`, `qrcode.react`, Web Share API |
| **Backend** | NestJS 12, Passport JWT, `@nestjs/schedule` (cron kedaluwarsa quest), class-validator |
| **Database** | PostgreSQL / Supabase via Prisma 5 |
| **Realtime (rencana)** | Supabase Realtime atau WebSocket NestJS untuk Group Run |
| **Monorepo** | npm workspaces + `concurrently` |

### Alur Data

```
React PWA ──REST (JWT)──NestJS API ──Prisma──PostgreSQL (Supabase)
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
│   │   ├── store/AppContext.tsx       # State global + titik integrasi API (TODO)
│   │   ├── services/
│   │   │   ├── endpoints.ts           # Kontrak REST FE ↔ BE ([ADA] / [BELUM])
│   │   │   ├── http.ts                # HTTP client + JWT
│   │   │   └── groupRun.ts            # Interface transport realtime + mock
│   │   ├── hooks/                     # useGeoTracker (GPS), useGroupRun
│   │   ├── lib/                       # geo.ts (Haversine, pace), shareCard.ts (PNG + share)
│   │   ├── data/mock.ts               # Data awal prototype
│   │   ├── types/                     # Tipe domain
│   │   ├── routes.ts                  # Path & deep-link antar-halaman
│   │   └── App.tsx / main.tsx
│   ├── vite.config.ts                 # Vite + manifest PWA
│   └── package.json
├── backend/                           # NestJS REST API
│   ├── src/
│   │   ├── auth/                      # Register, login, JWT guard, /auth/me
│   │   ├── squads/                    # Circle: buat, join kode, leaderboard, leave, kick
│   │   ├── quests/                    # Bomb Mission: buat, accept, shield, cron expire
│   │   ├── activities/                # Rekam aktivitas, riwayat, detail
│   │   ├── database/                  # PrismaService
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
| Login & Onboarding | `/login` | Auth (email/Google), Create Circle, Join Circle (kode 8 karakter) |
| Home | `/dashboard` | Sapaan, circle switcher + share kode, statistik, quick start Solo/Group Run, misi circle, leaderboard |
| Quests | `/custom-quest` | Saldo koin, form Bomb Mission, tab Received / Sent |
| Activity | `/activity` | Mode Solo / Group Run, pilih misi, peta + metrik real-time, tombol kontrol sticky, verifikasi, Share Card |
| Profile | `/profile` | Identitas & statistik, dompet & top-up, riwayat + galeri rute, circle, Appearance (tema), pengaturan, sign out |

Navigasi: top bar (logo, saldo koin, toggle tema) + bottom navigation berisi ikon dan label kecil (Home · Quests · Activity · Profile). Bahasa UI: **Inggris**.

Deep-link yang didukung: `/activity?mission=<id>`, `/activity?mode=group&room=<id>`, `/profile?topup=1`, `/login?step=circle&code=<kode>` (dipakai QR di Share Card). Semua halaman selain `/login` dilindungi auth guard.

### Status Integrasi Frontend ↔ Backend

UI saat ini berjalan penuh dengan **data mock** (`frontend/src/data/mock.ts`) melalui `AppContext`. Untuk integrasi:

1. **REST** — ganti isi aksi bertanda `TODO` di `store/AppContext.tsx` dengan `http()` dari `services/http.ts`.
2. **Endpoint yang belum ada di backend** (bertanda [BELUM] di `services/endpoints.ts`): `group-runs/*`, `wallet/*` (top-up & webhook payment gateway), `POST /quests/:id/reject`, `POST /auth/google`, `GET /squads/:id/missions`. `GET /activities/history` perlu menyertakan field `route` untuk Share Card.
3. **Group Run realtime** — implementasikan interface `GroupRunTransport` (Supabase Realtime / WebSocket) lalu ganti export di `services/groupRun.ts`. UI tidak perlu diubah.

---

## Tim & Struktur Peran

| Peran | Tanggung Jawab Utama |
| :--- | :--- |
| **Project Manager & Lead Backend** | Roadmap produk, alur gamifikasi, arsitektur database Supabase/PostgreSQL, algoritma verifikasi GPS & Anti-Cheat, integrasi payment gateway. |
| **Fullstack Developer** | Integrasi backend & frontend, REST API, Group Run realtime (Supabase Realtime / WebSocket), Row Level Security (RLS). |
| **Lead Frontend Developer (PWA)** | Fondasi React PWA (Vite + Tailwind), state management, GPS tracker, integrasi peta rute (Leaflet), kesiapan Capacitor. |
| **Frontend Developer (UI/UX)** | Antarmuka interaktif, animasi pop-up Bomb Mission, leaderboard, desain Share Social Track Map Card, UX polish. |

---

## Memulai (Quick Start)

Prasyarat: **Node.js ≥ 20** dan database PostgreSQL (lokal atau Supabase). Semua perintah dijalankan dari **root** repositori.

### 1. Instal dependensi
```bash
npm install          # frontend + backend; Prisma Client otomatis di-generate (postinstall)
```

### 2. Konfigurasi environment

`backend/.env` (lihat `backend/.env.example`):
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/[DB_NAME]?schema=public"
JWT_SECRET="ganti-dengan-secret-acak-yang-panjang"
PORT=3000
```

`frontend/.env` (lihat `frontend/.env.example`):
```env
VITE_API_BASE_URL="http://localhost:3000"
VITE_SUPABASE_URL=""        # opsional, untuk Group Run realtime
VITE_SUPABASE_ANON_KEY=""
```

### 3. Sinkronisasi database
```bash
npm run db:push                  # dorong skema Prisma ke database
npm run seed --workspace backend # (opsional) isi data awal
```

### 4. Jalankan aplikasi
```bash
npm run dev            # frontend (http://localhost:5173) + backend (http://localhost:3000)
npm run dev:frontend   # hanya frontend
npm run dev:backend    # hanya backend
```

> Frontend dapat dijalankan **tanpa backend** karena masih memakai data mock. Di desktop, centang **Mode simulasi** pada halaman Activity untuk menguji GPS. GPS asli butuh HTTPS atau `localhost`.

### Daftar Script Root

| Script | Fungsi |
| :--- | :--- |
| `npm run dev` | Frontend + backend bersamaan (`concurrently`) |
| `npm run build` | Build frontend (`frontend/dist`) + backend (`backend/dist`) |
| `npm run build:frontend` / `build:backend` | Build per aplikasi |
| `npm run typecheck` | Type-check frontend |
| `npm run prisma:generate` | Generate ulang Prisma Client setelah `schema.prisma` berubah |
| `npm run db:push` | Sinkronkan skema ke database |

Uji fitur PWA (install & offline) dari hasil build, karena service worker dinonaktifkan saat dev:
```bash
npm run build:frontend && npm run preview --workspace frontend
```

---

## Panduan Branching & Commit (Git Best Practices)

### 1. Aturan Penamaan Branch

Format: `<tipe>/<nama-singkat-fitur>` (huruf kecil, pemisah `-`):

| Tipe Branch | Tujuan Penggunaan | Contoh Penamaan |
| :--- | :--- | :--- |
| `feat/` | Pengembangan fitur baru | `feat/squad-invite-code`, `feat/group-run-realtime` |
| `fix/` | Perbaikan bug atau error | `fix/gps-haversine-calc`, `fix/auth-token-expiry` |
| `docs/` | Perubahan dokumentasi | `docs/api-specification`, `docs/setup-guide` |
| `refactor/` | Perapihan kode tanpa mengubah fungsi | `refactor/prisma-service`, `refactor/app-context` |
| `test/` | Unit test / e2e | `test/auth-controller`, `test/geo-utils` |
| `chore/` | Dependensi, konfigurasi, build tool | `chore/update-deps`, `chore/setup-eslint` |

### 2. Standar Pesan Commit (*Conventional Commits*)

Struktur: `<tipe>(<lingkup>): <deskripsi singkat>`. Gunakan lingkup sesuai area kode, misalnya `squad`, `quest`, `activity`, `auth` (backend) atau `frontend`, `dashboard`, `share-card`, `group-run` (frontend).

* **Contoh:**
  * `feat(squad): implement 8-char invite code generator`
  * `feat(quest): add bomb mission creation endpoint with coin check`
  * `feat(group-run): add supabase realtime transport`
  * `fix(gps): resolve speed spike anomaly on running mode`
  * `docs(readme): update monorepo architecture`
  * `test(auth): add unit test for register and login service`
* **Tips:** commit **atomik** (satu tugas per commit), pesan **jelas** (hindari *"update"* / *"fix bug"*), dan kalimat **imperatif** (`add`, `update`, `fix`, `remove`).

### 3. Alur Kerja dari Branch hingga Merge

```bash
# 1. Perbarui main lokal
git checkout main
git pull origin main

# 2. Buat branch baru
git switch -c feat/nama-fitur-baru

# 3. Kerjakan perubahan, lalu pastikan lolos build & type-check
npm run typecheck && npm run build

# 4. Periksa & stage file secara spesifik (hindari ikut ter-commit file .env)
git status
git add frontend/src/screens/ backend/src/squads/

# 5. Commit dengan pesan terstruktur
git commit -m "feat(squad): create circle and assign captain role"

# 6. Push branch ke GitHub
git push -u origin feat/nama-fitur-baru
```

Setelah di-push:
1. Buat **Pull Request** dari branch fitur ke `main` (template otomatis dari `.github/PULL_REQUEST_TEMPLATE.md`).
2. Setelah di-review dan lolos test, **Merge PR** ke `main`.
3. Hapus branch fitur yang sudah di-merge.

---

## Referensi Dokumen
* **Spesifikasi Teknis & Business Model Canvas:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](docs/SPESIFIKASI_PROYEK_CIDASH.md)
* **Checklist Progres & Roadmap:** [docs/CHECKLIST_PROGRES_PROYEK.md](docs/CHECKLIST_PROGRES_PROYEK.md)
* **Koleksi & Test API:** [docs/api/](docs/api/)
* **Detail frontend (struktur, deep-link, integrasi):** [frontend/README.md](frontend/README.md)
* **Detail backend:** [backend/README.md](backend/README.md)
