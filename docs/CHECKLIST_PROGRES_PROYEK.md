# CHECKLIST PROGRES & ROADMAP PENGERJAAN CIDASH
> **Pelacak Status Pengerjaan Fitur (Development Progress Tracker)**  
> **Versi:** 1.1 | **Pembaruan Terakhir:** Oktober 2026  
> **Dokumen Spesifikasi:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](file:///D:/CiDash/docs/SPESIFIKASI_PROYEK_CIDASH.md)

Dokumen ini melacak status pengerjaan seluruh fitur aplikasi **Cidash (Social Gamified Fitness Tracker)** berdasarkan dokumen spesifikasi teknis dan perancangan bisnis.

---

## Ringkasan Eksekutif Progres

| Kategori | Total Item | Selesai `[x]` | Belum `[ ]` | Status Progres |
| :--- | :---: | :---: | :---: | :---: |
| **1. Database & ORM (PostgreSQL / Prisma)** | 10 | 10 | 0 | **100%** |
| **2. Backend Core & Auth (NestJS)** | 7 | 7 | 0 | **100%** |
| **3. Backend Circle / Squad Module** | 6 | 6 | 0 | **100%** |
| **4. Backend Quest / Bomb Mission Module** | 6 | 6 | 0 | **100%** |
| **5. Backend Activity & GPS Tracker** | 5 | 5 | 0 | **100%** |
| **6. Algoritma Verifikasi & Anti-Cheat** | 4 | 4 | 0 | **100%** |
| **7. Ekonomi Koin & Payment Gateway** | 5 | 2 | 3 | **40%** |
| **8. Frontend Web App PWA (5 Screens + Integrasi API)** | 12 | 12 | 0 | **100%** |
| **9. Dokumentasi & Pitch Readiness** | 5 | 5 | 0 | **100%** |
| **TOTAL KESELURUHAN** | **60** | **57** | **3** | **95.0%** |

---

## 1. Basis Data & Model (PostgreSQL / Supabase & Prisma)
*Penanggung Jawab: Lead Backend & Database Architect*

- [x] **Setup Prisma ORM:** Konfigurasi koneksi database PostgreSQL di `prisma/schema.prisma`.
- [x] **Model `User`:** Kolom `id`, `email`, `passwordHash`, `name`, `coinBalance`, `rankPoints`, `shieldTickets`, `createdAt`.
- [x] **Model `Squad` (Groups):** Kolom `id`, `name`, `inviteCode` (unik 8 karakter), `isPremium`, relasi `createdBy`, `createdAt`.
- [x] **Model `SquadMember` (Group Members):** Relasi many-to-many, composite unique `(squadId, userId)`, dan role (`MEMBER`, `CAPTAIN`).
- [x] **Model `Activity` (Activity Logs):** Kolom `id`, `userId`, `type`, `distanceMeters`, `durationSeconds`, `averagePace`, `routeGeoJson`, waktu mulai & selesai.
- [x] **Model `Quest` (Missions):** Kolom `id`, `squadId`, `creatorId`, `targetUserId`, `activityType`, `targetDistance`, `targetMaxPace`, `stakesPoints`, `deadline`, `status`.
- [x] **Model `PointLedger` & `CoinTransaction`:** Catatan transaksi poin reputasi dan mutasi koin virtual (`TOP_UP`, `BOMB_MISSION_FEE`).
- [x] **Generasi Client:** `npx prisma generate` berhasil dijalankan otomatis melalui `postinstall` monorepo.
- [x] **Sinkronisasi Saldo Koin & Transaksi Koin:** Penambahan kolom `coinBalance` pada model `User` dan model `CoinTransaction` untuk tracking top up koin dan fee misi.
- [x] **Database Seeder (`prisma/seed.ts`):** Pembuatan data uji dummy (4 pelari demo `@cidash.id`, 1 circle 'GBK Sunset Runners' kode 'RUN8MORN', GPS activity log dengan rute GeoJSON GBK Senayan, Bomb Mission P2P, serta mutasi koin/poin).

---

## 2. Backend Core & Autentikasi (NestJS)
*Penanggung Jawab: Fullstack Developer & Lead Backend*

- [x] **Inisialisasi Project:** NestJS 12 dengan TypeScript, Oxlint, Prettier, CORS, dan Jest.
- [x] **Konfigurasi Lingkungan Zero-Setup:** `@nestjs/config` terintegrasi secara global dengan script otomatis `predev` dan fallback aman.
- [x] **Database Provider Anti-Crash:** `PrismaService` dan `DatabaseModule` dengan *graceful fallback* ketika database sedang tidak terjangkau.
- [x] **Registrasi Akun:** Endpoint `POST /auth/register` dengan validasi DTO, enkripsi password bcrypt, serta saldo awal 60 koin & 1 shield ticket.
- [x] **Login Pengguna:** Endpoint `POST /auth/login` menghasilkan JWT Bearer token.
- [x] **JWT Guard & Strategy:** `JwtAuthGuard` dan `JwtStrategy` untuk memproteksi endpoint privat.
- [x] **Current User Decorator & Profil:** Decorator `@CurrentUser()` dan endpoint `GET /auth/me`.

---

## 3. Backend Modul Circle / Squad (`/squads`)
*Penanggung Jawab: Fullstack Developer*

- [x] **Invite Code Generator:** Generator kode 8 karakter acak alfanumerik yang terjamin unik (misal: "RUN8MORN").
- [x] **Create Circle:** Endpoint `POST /squads` untuk membuat Circle baru dan otomatis menetapkan pembuat sebagai `CAPTAIN`.
- [x] **Join Circle:** Endpoint `POST /squads/join` dengan input kode 8 karakter unik.
- [x] **My Circles:** Endpoint `GET /squads/my` untuk mengambil daftar Circle yang diikuti pengguna aktif.
- [x] **Circle Leaderboard (+Total KM):** Endpoint `GET /squads/:id/leaderboard` untuk mengambil urutan ranking anggota berdasarkan `rankPoints` beserta akumulasi jarak `totalDistanceKm`.
- [x] **Manajemen Anggota:** Endpoint untuk keluar dari circle (`POST /squads/:id/leave`) atau mengeluarkan anggota bagi Captain (`DELETE /squads/:id/members/:userId`).

---

## 4. Backend Modul Gamifikasi Quest & Bomb Mission (`/quests`)
*Penanggung Jawab: Lead Backend & Gamification Specialist*

- [x] **Kirim Bomb Mission P2P:** Endpoint `POST /quests` dengan input `targetUserId`, `activityType`, `targetDistance`, `targetMaxPace`, `stakesPoints`, dan `deadline`.
- [x] **Validasi Koin:** Validasi dan pemotongan saldo koin pembuat tantangan saat misi dibuat (biaya 20 koin & pencatatan `CoinTransaction`).
- [x] **Daftar Active Missions:** Endpoint `GET /quests/active` untuk menampilkan semua misi aktif dari circle yang diikuti pengguna beserta hitung mundur waktu.
- [x] **Terima Tantangan Misi:** Endpoint `POST /quests/:id/accept` untuk mengubah status tantangan menjadi `ACCEPTED`.
- [x] **Tolak Tantangan & Shield Ticket:** Endpoint `POST /quests/:id/reject` dan `POST /quests/:id/shield` untuk membatalkan penalti poin menggunakan *Shield Ticket* atau menyerah (`FAILED`).
- [x] **Cron Auto-Expire:** Scheduler otomatis tiap jam (`@Cron(CronExpression.EVERY_HOUR)`) untuk mengecek misi yang melampaui deadline dan menandainya sebagai `FAILED` sekaligus memotong penalti poin target user dan memberi reward creator.

---

## 5. Backend Modul Tracking Aktivitas GPS (`/activities`)
*Penanggung Jawab: Fullstack Developer & Lead Backend*

- [x] **Submit Aktivitas:** Endpoint `POST /activities` menerima metrik `distanceMeters`, `durationSeconds`, `averagePace`, dan koordinat `routeGeoJson`.
- [x] **Validasi Anti-Cheat Otomatis:** Integrasi pemeriksaan batas kecepatan dan lonjakan titik koordinat sebelum aktivitas disimpan via `AntiCheatService`.
- [x] **Penyelesaian Quest Otomatis:** Logika pencocokan otomatis: jika aktivitas memenuhi syarat target jarak & target pace dari misi aktif target user, ubah status misi menjadi `COMPLETED` dan tautkan `activityId`.
- [x] **Alokasi Poin:** Penambahan `rankPoints` kepada pengguna (poin dasar aktivitas + bonus kemenangan misi) serta pencatatan mutasi di `PointLedger`.
- [x] **Riwayat Olahraga (+GeoJSON Route):** Endpoint `GET /activities/history` untuk melihat rekaman olahraga pengguna lampau dengan agregasi total jarak, durasi, dan `routeGeoJson` untuk pembuatan *Share Card*.

---

## 6. Algoritma Verifikasi GPS & Anti-Cheat
*Penanggung Jawab: Lead Backend Developer*

- [x] **Pace Anomaly Detector:** Validasi bahwa kecepatan rata-rata lari tidak melebihi batas anatomis manusia (maksimal kecepatan lari wajar < 8.5 m/s atau pace > 1.95 min/km).
- [x] **Vehicle Speed Spike Filter:** Deteksi akselerasi dan kecepatan tidak wajar untuk memfilter penggunaan sepeda motor/mobil pada saat lari.
- [x] **Haversine Teleportation Check:** Penghitungan jarak spasial antar titik koordinat berturutan menggunakan formula Haversine untuk menangkal fake GPS / lonjakan titik > 800 meter.
- [x] **Route Continuity Validator:** Verifikasi konsistensi panjang lintasan rute koordinat GPS terhadap total jarak yang dilaporkan.

---

## 7. Sistem Pembayaran & Ekonomi Koin
*Penanggung Jawab: Lead Backend Developer*

- [x] **Wallet & Top-Up Koin (`POST /auth/top-up`):** Penambahan saldo koin pengguna disertai pencatatan mutasi `TOP_UP` di tabel `CoinTransaction`.
- [x] **Starter Pack & Penggunaan Shield Ticket:** Alokasi koin awal saat registrasi dan pemakaian *Shield Ticket* otomatis pada modul Quest.
- [ ] **Integrasi Payment Gateway Eksternal:** Modul Midtrans Snap / Xendit Invoice untuk pembayaran uang asli.
- [ ] **Webhook Listener Payment Gateway:** Endpoint webhook untuk menerima callback pembayaran eksternal.
- [ ] **Siklus Musim (Season Reset 3 Bulan):** Prosedur reset papan skor berkala tiap 3 bulan dengan pengarsipan riwayat peringkat musim sebelumnya.

---

## 8. Frontend Web App PWA (React + TypeScript + Tailwind + Leaflet)
*Penanggung Jawab: Lead Frontend (PWA) & Frontend UI/UX*

- [x] **Arsitektur React PWA & Monorepo:** Setup Vite 5, TypeScript, Tailwind CSS (Light/Dark Mode Tokens), Service Worker (`vite-plugin-pwa`), dan integrasi penuh `AppContext` + `http.ts` ke Backend NestJS.
- [x] **Layar 1 — Login & Onboarding (`/login`):**
  * UI Sign in, Sign up, dan tombol cepat akun demo (`budi@cidash.id`).
  * Form pembuatan Circle baru dan input kode undangan Circle 8 karakter (`POST /squads` & `POST /squads/join`).
- [x] **Layar 2 — Dashboard (`/dashboard`):**
  * Header nama Circle, switcher antar-circle, dan tombol bagikan kode grup.
  * Widget Papan Peringkat (Leaderboard) terhubung ke `GET /squads/:id/leaderboard`.
  * Widget ringkasan kartu *Circle Missions* dan pintasan cepat *Solo Run* / *Group Run*.
- [x] **Layar 3 — Custom Quest (`/custom-quest`):**
  * Pemilihan target teman satu Circle secara dinamis dari anggota asli Circle.
  * Input target jarak (KM), batas waktu (menit), deadline, dan slider taruhan koin (`POST /quests`).
  * Tab *Received* & *Sent* lengkap dengan aksi *Accept & start* dan *Decline* (`POST /quests/:id/accept` & `reject`).
- [x] **Layar 4 — Activity Tracker (`/activity`):**
  * Peta rute real-time menggunakan OpenStreetMap & React-Leaflet (`RouteMap.tsx`).
  * Pelacak GPS (`useGeoTracker.ts`) dengan dukungan **GPS Asli** dan **Simulation Mode** untuk pengujian di laptop/desktop.
  * Mode *Solo / Quest* dan *Live Group Run* (`GroupRunPanel.tsx`), pop-up hasil verifikasi (`VerificationModal.tsx`), dan pengiriman aktivitas ke `POST /activities`.
- [x] **Layar 5 — Profile, Wallet & Share Card (`/profile`):**
  * Tampilan identitas akun, total jarak tempuh, dan *Rank Points*.
  * Dompet koin dan fitur *Top Up* koin instan (`POST /auth/top-up`).
  * Riwayat aktivitas olahraga lengkap dengan siluet rute SVG (`RouteSvg.tsx`) dan generator **Social Share Card** PNG 1080×1920 ber-QR Code (`ShareCardModal.tsx`).

---

## 9. Dokumentasi & Pitch Readiness
*Penanggung Jawab: Project Manager & Tim*

- [x] **Dokumen Spesifikasi Teknis & Bisnis:** `docs/SPESIFIKASI_PROYEK_CIDASH.md` (Lengkap 12 bab).
- [x] **Dokumen Checklist & Roadmap:** `docs/CHECKLIST_PROGRES_PROYEK.md`.
- [x] **README Utama & Frontend:** `README.md` dan `frontend/README.md`.
- [x] **README Layanan Backend:** `backend/README.md` dengan panduan teknis dan daftar endpoint lengkap.
- [x] **Koleksi Pengujian API:** `docs/api/CiDash.postman_collection.json` dan `docs/api/api-test.http`.

---

*Daftar ini diperbarui sesuai kondisi terkini repositori monorepo Cidash.*
