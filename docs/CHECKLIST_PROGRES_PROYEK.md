# 📋 CHECKLIST PROGRES & ROADMAP PENGERJAAN CIDASH
> **Pelacak Status Pengerjaan Fitur (Development Progress Tracker)**  
> **Versi:** 1.0 | **Pembaruan Terakhir:** Oktober 2026  
> **Dokumen Spesifikasi:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](file:///D:/CiDash/docs/SPESIFIKASI_PROYEK_CIDASH.md)

Dokumen ini melacak status pengerjaan seluruh fitur aplikasi **Cidash (Social Gamified Fitness Tracker)** berdasarkan dokumen spesifikasi teknis dan perancangan bisnis (`D:\Cidash_Project_Document.pdf`).

---

## 📊 Ringkasan Eksekutif Progres

| Kategori | Total Item | Selesai `[x]` | Belum `[ ]` | Status Progres |
| :--- | :---: | :---: | :---: | :---: |
| **1. Database & ORM (PostgreSQL / Prisma)** | 10 | 10 | 0 | **100%** |
| **2. Backend Core & Auth (NestJS)** | 7 | 7 | 0 | **100%** |
| **3. Backend Circle / Squad Module** | 6 | 6 | 0 | **100%** |
| **4. Backend Quest / Bomb Mission Module** | 5 | 5 | 0 | **100%** |
| **5. Backend Activity & GPS Tracker** | 5 | 0 | 5 | **0%** |
| **6. Algoritma Verifikasi & Anti-Cheat** | 4 | 0 | 4 | **0%** |
| **7. Payment Gateway & Ekonomi Koin** | 5 | 0 | 5 | **0%** |
| **8. Frontend Mobile (Flutter 5 Screens)** | 12 | 0 | 12 | **0%** |
| **9. Dokumentasi & Pitch Readiness** | 5 | 5 | 0 | **100%** |
| **TOTAL KESELURUHAN** | **59** | **33** | **26** | **55.9%** |

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
- [x] **Generasi Client:** `npx prisma generate` berhasil dijalankan dan diintegrasikan ke kode backend.
- [x] **Sinkronisasi Saldo Koin & Transaksi Koin:** Penambahan kolom `coinBalance` pada model `User` dan model `CoinTransaction` untuk tracking top up koin dan fee misi.
- [x] **Database Seeder (`prisma/seed.ts`):** Pembuatan data uji dummy (4 pelari demo, 1 circle 'GBK Sunset Runners' kode 'RUN8MORN', GPS activity log dengan rute GeoJSON GBK Senayan, Bomb Mission P2P, serta mutasi koin/poin).

---

## 2. Backend Core & Autentikasi (NestJS)
*Penanggung Jawab: Fullstack Developer & Lead Backend*

- [x] **Inisialisasi Project:** NestJS 12 dengan TypeScript, Oxlint, Prettier, dan Jest.
- [x] **Konfigurasi Lingkungan:** `@nestjs/config` terintegrasi secara global (`.env`).
- [x] **Database Provider:** `PrismaService` dan `DatabaseModule` siap pakai.
- [x] **Registrasi Akun:** Endpoint `POST /auth/register` dengan validasi DTO dan enkripsi password bcrypt.
- [x] **Login Pengguna:** Endpoint `POST /auth/login` menghasilkan JWT Bearer token.
- [x] **JWT Guard & Strategy:** `JwtAuthGuard` dan `JwtStrategy` untuk memproteksi endpoint privat.
- [x] **Current User Decorator & Profil:** Decorator `@CurrentUser()` dan endpoint `GET /auth/me`.

---

## 3. Backend Modul Circle / Squad (`/squads`)
*Penanggung Jawab: Fullstack Developer*

- [x] **Invite Code Generator:** Generator kode 8 karakter acak alfanumerik yang terjamin unik (misal: "RUN78XYZ").
- [x] **Create Circle:** Endpoint `POST /squads` untuk membuat Circle baru dan otomatis menetapkan pembuat sebagai `CAPTAIN`.
- [x] **Join Circle:** Endpoint `POST /squads/join` dengan input kode 8 karakter unik.
- [x] **My Circles:** Endpoint `GET /squads/my` untuk mengambil daftar Circle yang diikuti pengguna aktif.
- [x] **Circle Leaderboard:** Endpoint `GET /squads/:id/leaderboard` untuk mengambil urutan ranking anggota berdasarkan `rankPoints` pada musim aktif.
- [x] **Manajemen Anggota:** Endpoint untuk keluar dari circle (`POST /squads/:id/leave`) atau mengeluarkan anggota bagi Captain (`DELETE /squads/:id/members/:userId`).

---

## 4. Backend Modul Gamifikasi Quest & Bomb Mission (`/quests`)
*Penanggung Jawab: Lead Backend & Gamification Specialist*

- [x] **Kirim Bomb Mission P2P:** Endpoint `POST /quests` dengan input `targetUserId`, `activityType`, `targetDistance`, `targetMaxPace`, `stakesPoints`, dan `deadline`.
- [x] **Validasi Koin:** Validasi dan pemotongan saldo koin pembuat tantangan saat misi dibuat (biaya 20 koin & pencatatan CoinTransaction).
- [x] **Daftar Active Missions:** Endpoint `GET /quests/active` untuk menampilkan semua misi aktif dari circle yang diikuti pengguna beserta hitung mundur waktu.
- [x] **Respons Misi & Shield Ticket:** Endpoint `POST /quests/:id/shield` untuk menggunakan item perlindungan pembatal pinalti poin (mengubah status menjadi SHIELDED).
- [x] **Cron Auto-Expire:** Scheduler otomatis tiap jam (`@Cron(CronExpression.EVERY_HOUR)`) untuk mengecek misi yang melampaui deadline dan menandainya sebagai `FAILED` sekaligus memotong pinalti poin target user dan memberi reward creator.

---

## 5. Backend Modul Tracking Aktivitas GPS (`/activities`)
*Penanggung Jawab: Fullstack Developer & Lead Backend*

- [ ] **Submit Aktivitas:** Endpoint `POST /activities` menerima metrik `distanceMeters`, `durationSeconds`, `averagePace`, dan array koordinat `routeGeoJson`.
- [ ] **Validasi Anti-Cheat Otomatis:** Integrasi pemeriksaan batas kecepatan dan lonjakan titik koordinat sebelum aktivitas disimpan.
- [ ] **Penyelesaian Quest Otomatis:** Logika pencocokan otomatis: jika aktivitas memenuhi syarat target jarak & target pace dari misi aktif target user, ubah status misi menjadi `COMPLETED`.
- [ ] **Alokasi Poin:** Penambahan `rankPoints` kepada pengguna dan pemenang taruhan, serta pencatatan mutasi di `PointLedger`.
- [ ] **Riwayat Olahraga:** Endpoint `GET /activities/history` untuk melihat rekaman olahraga pengguna lampau.

---

## 6. Algoritma Verifikasi GPS & Anti-Cheat
*Penanggung Jawab: Lead Backend Developer (Python / TypeScript)*

- [ ] **Pace Anomaly Detector:** Validasi bahwa kecepatan rata-rata lari tidak melebihi batas anatomis manusia (maksimal 2:30 min/km).
- [ ] **Vehicle Speed Spike Filter:** Deteksi akselerasi tidak wajar (indikasi naik motor/mobil saat perekaman lari).
- [ ] **Haversine Teleportation Check:** Penghitungan jarak spasial antar titik koordinat berturutan ($\Delta d / \Delta t$) untuk menangkal fake GPS / koordinat palsu.
- [ ] **Route Continuity Validator:** Verifikasi kontinuitas rute dan kerapatan titik koordinat GPS.

---

## 7. Sistem Pembayaran & Ekonomi Koin
*Penanggung Jawab: Lead Backend Developer*

- [ ] **Wallet & Saldo Koin:** Endpoint `GET /coins/balance` dan riwayat mutasi `GET /coins/history`.
- [ ] **Integrasi Payment Gateway:** Modul Midtrans Snap / Xendit Invoice untuk pembelian paket koin (`POST /coins/topup`).
- [ ] **Webhook Listener:** Endpoint `POST /coins/webhook` untuk menerima konfirmasi pembayaran sukses dan penambahan saldo otomatis.
- [ ] **Toko Item Digital (Shield Pass):** Endpoint pembelian item pelindung anti-bom koin (`POST /coins/buy-shield`).
- [ ] **Siklus Musim (Season Reset 3 Bulan):** Prosedur reset papan skor berkala tiap 3 bulan dengan pengarsipan riwayat peringkat musim sebelumnya.

---

## 8. Frontend Mobile (Flutter)
*Penanggung Jawab: Lead Frontend Mobile & Frontend UI/UX*

- [ ] **Arsitektur Flutter:** Inisialisasi project Flutter dengan State Management (Bloc / Riverpod) dan REST API client (Dio).
- [ ] **Layar 1 — Login & Onboarding:**
  * UI Login & Register yang clean dan cepat.
  * Form cepat input kode Circle 8 karakter.
- [ ] **Layar 2 — Dashboard:**
  * Header nama Circle dan badge kode grup.
  * Widget Papan Peringkat Harian (Leaderboard) dengan animasi peringkat.
  * Widget ringkasan kartu *Active Missions* yang sedang berlangsung.
- [ ] **Layar 3 — Custom Quest (P2P Bomb Mission):**
  * Modal interaktif pemilihan target teman segrup.
  * Slider input target jarak (KM), pace, dan taruhan koin/Rank Points.
  * Animasi pop-up efek Bomb Mission yang atraktif.
- [ ] **Layar 4 — Activity Tracker:**
  * Tampilan peta rute real-time menggunakan OpenStreetMap / Leaflet (Flutter Map).
  * Layanan *Background GPS Geolocation* (tetap merekam saat layar mati).
  * Dashboard metrik live: Jarak, Durasi waktu, dan Rata-rata Pace.
  * Tombol interaktif *Start*, *Pause*, dan *Finish*.
- [ ] **Layar 5 — Profile & Wallet Koin:**
  * Tampilan identitas akun, level, total jarak tempuh, dan Rank Points.
  * Riwayat aktivitas olahraga terdahulu.
  * Widget Saldo Koin dan tombol pemicu Top Up.
  * Integrasi SDK UI Payment Gateway / Webview pembayaran.

---

## 9. Dokumentasi & Pitch Readiness
*Penanggung Jawab: Project Manager & Tim*

- [x] **Dokumen Spesifikasi Teknis & Bisnis:** `docs/SPESIFIKASI_PROYEK_CIDASH.md` (Lengkap 12 bab).
- [x] **Dokumen Checklist & Roadmap:** `docs/CHECKLIST_PROGRES_PROYEK.md`.
- [x] **README Utama Repositori:** `README.md` pada root project.
- [x] **README Layanan Backend:** `backend/README.md` dengan panduan teknis dan pemetaan skema Prisma.
- [x] **Skenario Demo Pitch 5 Layar & BMC:** Narasi presentasi per layar dan 9 blok Business Model Canvas.

---

*Daftar ini akan diperbarui secara berkala seiring berjalannya sprint pengembangan aplikasi Cidash.*
