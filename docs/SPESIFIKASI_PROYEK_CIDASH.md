# CIDASH — SPESIFIKASI TEKNIS, ALUR KERJA & PERANCANGAN BISNIS
**Kategori:** Social Gamified Fitness Tracker  
**Versi Dokumen:** 1.0 (Oktober 2026)  
**Dokumen Sumber:** `D:\Cidash_Project_Document.pdf`  
**Target:** Business Plan Competition & Technical Execution  

---

## DAFTAR ISI
1. [Ringkasan Eksekutif & Deskripsi Produk](#1-ringkasan-eksekutif--deskripsi-produk)
2. [Analisis Masalah & Solusi (Problem-Solution Fit)](#2-analisis-masalah--solusi-problem-solution-fit)
3. [Pembagian Tim & Struktur Organisasi](#3-pembagian-tim--struktur-organisasi)
4. [Arsitektur Sistem & Spesifikasi Teknologi](#4-arsitektur-sistem--spesifikasi-teknologi)
5. [Alur Kerja (Workflow) Aplikasi](#5-alur-kerja-workflow-aplikasi)
6. [Tampilan Screen Prototype & Skenario Pitch Demo](#6-tampilan-screen-prototype--skenario-pitch-demo)
7. [Perancangan Basis Data (Database Design)](#7-perancangan-basis-data-database-design)
8. [Algoritma Verifikasi GPS & Anti-Cheat](#8-algoritma-verifikasi-gps--anti-cheat)
9. [Business Model Canvas (BMC) & Strategi Monetisasi](#9-business-model-canvas-bmc--strategi-monetisasi)
10. [Spesifikasi REST API & Kontrak Data Backend](#10-spesifikasi-rest-api--kontrak-data-backend)
11. [Panduan Instalasi & Eksekusi Proyek](#11-panduan-instalasi--eksekusi-proyek)
12. [Status Implementasi & Checklist Pengerjaan Proyek](#12-status-implementasi--checklist-pengerjaan-proyek)

---

## 1. RINGKASAN EKSEKUTIF & DESKRIPSI PRODUK

**Cidash (Circle Dashboard / Circle Dash)** adalah platform *Social Gamified Fitness Tracker* berbasis komunitas privat (*invite-only*). Aplikasi ini diciptakan untuk menjawab keresahan pelari dan pesepeda kasual yang kerap mengalami rasa canggung (*social anxiety*) serta intimidasi sosial saat membagikan capaian olahraga di platform media sosial publik seperti Strava, Instagram, atau Nike Run Club.

Dengan Cidash, aktivitas olahraga kasual diubah menjadi arena bermain (*gamified competition*) yang seru, inklusif, dan aman di dalam lingkaran pertemanan terpercaya:
* **Circle Kode 8 Karakter:** Akses grup privat eksklusif tanpa intervensi publik.
* **P2P Bomb Mission:** Mekanisme saling tantang antar-teman berbayar koin virtual dengan taruhan *Rank Point*.
* **GPS Tracking & Verifikasi Otomatis:** Perekaman aktivitas rute, jarak, dan pace secara real-time yang diverifikasi dengan algoritma anti-cheat.
* **Siklus Musim (Season Reset 3 Bulan):** Papan peringkat di-reset secara berkala per kuartal guna menjaga motivasi dan mencegah stagnasi dominasi pemain lama.

---

## 2. ANALISIS MASALAH & SOLUSI (PROBLEM-SOLUTION FIT)

| Masalah Utama (Pain Point) | Realita di Lapangan | Solusi Inovatif Cidash |
| :--- | :--- | :--- |
| **Social Anxiety Berolahraga** | Pemula dan pelari kasual merasa malu membagikan kecepatan (*pace* lambat) atau jarak pendek di platform olahraga publik. | **Private Circle Only (Invite Code 8 Karakter)**: Hanya orang yang memiliki kode unik yang dapat melihat aktivitas dalam grup. |
| **Monoton & Kurang Gamifikasi** | Aplikasi kebugaran konvensional hanya fokus pada metrik angka statis (grafik dan riwayat angka). | **P2P Bomb Mission & Taruhan Rank Point**: Mekanisme misi saling menantang teman dengan *stakes*, batas waktu, dan efek hukuman/hadiah. |
| **Kesenjangan Leaderboard Permanen** | Pengguna baru enggan berkompetisi karena peringkat teratas selalu dikuasai atlet lama tanpa reset. | **Season Reset 3 Bulan**: Papan skor diperbarui berkala sehingga setiap anggota memiliki peluang juara baru tiap musim. |
| **Kecurangan Data Olahraga** | Pengguna menggunakan kendaraan bermotor atau fake GPS untuk memanipulasi metrik. | **Algoritma Verifikasi GPS & Anti-Cheat**: Validasi otomatis batas kecepatan realistis (*max pace check*) dan integritas koordinat. |

---

## 3. PEMBAGIAN TIM & STRUKTUR ORGANISASI

Tim pengembang Cidash terdiri dari 4 peran spesialis yang mencakup aspek kepemimpinan produk, arsitektur backend, aplikasi mobile, hingga interaksi UI/UX:

```mermaid
graph TD
    A["Project Manager (PM) & Lead Backend<br/>Roadmap, DB Architecture, GPS Anti-Cheat, Payment"] --> B["Fullstack Developer<br/>API Integration, Realtime Supabase, RLS & Security"]
    A --> C["Lead Frontend Developer (Mobile)<br/>Flutter Core, State Management, Background GPS Service"]
    C --> D["Frontend Developer (UI/UX)<br/>Interactive UI, Bomb Mission Pop-up, Animations, Leaderboard"]
```

### Rincian Tanggung Jawab & Deliverables

1. **Project Manager (PM) & Lead Backend Developer**
   * **Fokus:** Mengelola roadmap produk, alur gamifikasi (*game mechanics & coin economy*), perancangan arsitektur basis data (PostgreSQL/Supabase & Prisma ORM).
   * **Teknis:** Mengembangkan algoritma verifikasi sensor GPS dan deteksi kecurangan (*anti-cheat logic*), serta mengintegrasikan *payment gateway* (Midtrans/Xendit) untuk top up koin.

2. **Fullstack Developer**
   * **Fokus:** Menghubungkan logika bisnis backend dengan antarmuka frontend mobile/web.
   * **Teknis:** Mengelola REST API, kontrak DTO, WebSockets / Realtime Subscriptions, serta memastikan integritas dan keamanan data melalui *Row Level Security* (RLS) dan otorisasi JWT.

3. **Lead Frontend Developer (Mobile)**
   * **Fokus:** Membangun fondasi arsitektur aplikasi mobile berbasis Flutter (Android & iOS).
   * **Teknis:** Mengelola *State Management* (Bloc/Provider/Riverpod), implementasi *Foreground/Background GPS Service* untuk tracking rute tanpa terputus saat layar mati, serta rendering peta interaktif.

4. **Frontend Developer (UI/UX & Interactive Features)**
   * **Fokus:** Mengimplementasikan desain grafis ke widget Flutter yang responsif dan interaktif.
   * **Teknis:** Mendesain animasi interaktif (seperti *pop-up Bomb Mission*, hitung mundur bom, efek kemenangan), merancang *Leaderboard visual*, dan memaksimalkan kenyamanan pengguna (*user experience*).

---

## 4. ARSITEKTUR SISTEM & SPESIFIKASI TEKNOLOGI

```mermaid
flowchart TD
    subgraph Client ["Client Layer (Flutter Mobile App)"]
        UI["Flutter UI (Dart)"]
        GPS_SVC["Background GPS Service<br/>(Geolocator / Location Engine)"]
        MAPS["Map Renderer<br/>(OpenStreetMap / Leaflet)"]
    end

    subgraph Gateway ["API & Application Layer"]
        NEST["NestJS Backend API<br/>(Node.js / TypeScript)"]
        AUTH_MD["Auth & JWT Guard"]
        CHEAT_ENGINE["GPS Verification & Anti-Cheat Engine<br/>(Pace/Speed/Haversine Validator)"]
    end

    subgraph Data ["Data & Storage Layer"]
        PG["PostgreSQL (Supabase)"]
        PRISMA["Prisma ORM"]
        REALTIME["Supabase Realtime Engine<br/>(Leaderboard & Mission Updates)"]
    end

    subgraph External ["External Third-Party Services"]
        PGW["Payment Gateway<br/>(Midtrans / Xendit)"]
        TILES["Map Tile Provider<br/>(OSM Free Tiles)"]
    end

    UI --> GPS_SVC
    UI --> MAPS
    MAPS --> TILES
    UI -- "REST API / HTTPS" --> NEST
    UI -- "Realtime Websocket" --> REALTIME
    NEST --> AUTH_MD
    NEST --> CHEAT_ENGINE
    NEST --> PRISMA
    PRISMA --> PG
    PG --> REALTIME
    NEST -- "Create Invoice & Webhook" --> PGW
```

### Rincian Komponen Teknologi:
* **Mobile Framework:** Flutter (Dart) untuk efisiensi kompilasi multiplatform performa tinggi.
* **Server Framework:** NestJS (TypeScript) dengan arsitektur modular (*Controller, Service, Guard, DTO, Entity*).
* **Database & ORM:** PostgreSQL 16+ via Supabase dengan Prisma ORM untuk skema tersinkronisasi tipe (*type-safe*).
* **Geolokasi & Peta:** OpenStreetMap (OSM) dan Leaflet / Flutter Map untuk visualisasi rute hemat biaya (*zero license fee*).
* **Payment Gateway:** Midtrans / Xendit untuk memfasilitasi transaksi mikro koin (QRIS, E-Wallet, Virtual Account).

---

## 5. ALUR KERJA (WORKFLOW) APLIKASI

Alur kerja operasional Cidash terbagi menjadi 5 fase utama:

```mermaid
sequenceDiagram
    autonumber
    actor User as Pengguna
    participant App as Flutter Mobile App
    participant API as NestJS Backend
    participant DB as PostgreSQL / Prisma
    participant PGW as Payment Gateway

    Note over User, DB: 1. Auth & Onboarding
    User->>App: Registrasi / Login
    App->>API: POST /auth/login atau /auth/register
    API->>DB: Simpan / Validasi kredensial
    DB-->>API: Data User + Token JWT
    API-->>App: Respons Berhasil + JWT Token

    Note over User, DB: 2. Circle Management
    User->>App: Input Kode Grup 8 Karakter (cth: "RUN78XYZ")
    App->>API: POST /squads/join { inviteCode }
    API->>DB: Validasi kode unik & buat record SquadMember
    DB-->>API: Konfirmasi keanggotaan
    API-->>App: Tampilkan Dashboard Circle

    Note over User, DB: 3. Custom Quest (Bomb Mission)
    User->>App: Kirim Bomb Mission ke teman + pasang koin
    App->>API: POST /quests { targetUserId, distance, maxPace, stakes }
    API->>DB: Potong koin pembuat, buat Quest status PENDING
    DB-->>API: Misi tersimpan
    API-->>App: Notifikasi Realtime ke Target User

    Note over User, DB: 4. Activity & Perekaman GPS
    User->>App: Pilih Misi -> Tekan "Start"
    App->>App: Aktifkan Background GPS Service & catat rute
    User->>App: Tekan "Finish"
    App->>API: POST /activities { distance, duration, pace, routeGeoJson }
    API->>API: Validasi Anti-Cheat (Kecepatan, Lonjakan Titik)
    API->>DB: Simpan ActivityLog, ubah Quest -> COMPLETED
    API->>DB: Tambah Rank Point pemenang & update Leaderboard

    Note over User, PGW: 5. Coin Economy & Top Up
    User->>App: Buka Halaman Profil -> Pilih Paket Koin
    App->>API: POST /coins/topup { packageId }
    API->>PGW: Buat transaksi pembayaran (Snap/Invoice)
    PGW-->>App: Tampilkan UI Pembayaran (QRIS/E-Wallet)
    User->>PGW: Selesaikan pembayaran
    PGW->>API: Webhook Callback (Status: Settlement)
    API->>DB: Tambah saldo koin user & rekam coin_transactions
```

---

## 6. TAMPILAN SCREEN PROTOTYPE & SKENARIO PITCH DEMO

Bagian ini dirancang secara khusus untuk kebutuhan demonstrasi prototipe (*Pitching Competition*):

```
+-----------------------------------------------------------------------------------+
|                                 CIDASH APP SCREENS                                |
+-----------------+-----------------+-----------------+-----------------+-----------+
| Layar 1         | Layar 2         | Layar 3         | Layar 4         | Layar 5   |
| [ Login Page ]  | [ Dashboard ]   | [ Custom Quest] | [ Activity ]    | [ Profile]|
| - Email / Pass  | - Circle Name   | - Select Friend | - Live GPS Map  | - Avatar  |
| - 8-Char Code   | - Leaderboard   | - Bomb Stakes   | - Distance/Pace | - Coins   |
| - Fast Auth     | - Active Quest  | - Set Deadline  | - Start/Finish  | - Top Up  |
+-----------------+-----------------+-----------------+-----------------+-----------+
```

### Layar 1: Login Page
* **Komponen Visual:** Kolom Email & Password, Tombol "Masuk Cepat", Opsi pendaftaran instan, dan field input awal Kode Circle 8 Karakter.
* **Narasi Pitch Demo:**
  > *"Demo kita mulai dari Login Page. Pengguna melakukan autentikasi masuk ke dalam Cidash secara cepat untuk langsung masuk ke ruang grup privatnya tanpa takut dihakimi publik."*

### Layar 2: Dashboard
* **Komponen Visual:** Kartu Circle yang diikuti (header kode 8 karakter unik), *Daily Leaderboard* dengan ranking animasi, dan daftar ringkasan kartu *Active Missions* yang sedang berjalan.
* **Narasi Pitch Demo:**
  > *"Di Dashboard, pengguna dapat melihat grup privat yang diikuti via Kode 8 Karakter, papan peringkat harian, serta ringkasan seluruh Active Mission yang sedang berjalan."*

### Layar 3: Custom Quest
* **Komponen Visual:** Modal kirim tantangan P2P, pemilihan target teman segrup, opsi target jarak & batas waktu, jumlah taruhan koin (*stakes*), dan preview *Rank Point* yang dipertaruhkan.
* **Narasi Pitch Demo:**
  > *"Halaman Custom Quest adalah pusat gamifikasi. Menggunakan koin, pengguna dapat mengirimkan Bomb Mission kustom secara P2P ke teman segrupnya dengan taruhan Rank Point."*

### Layar 4: Activity
* **Komponen Visual:** Peta rute real-time berbasis OpenStreetMap, metrik besar (Jarak dalam KM, Durasi dalam menit/detik, Rata-rata Pace min/km), tombol aksi *Start*, *Pause*, dan *Finish*.
* **Narasi Pitch Demo:**
  > *"Saat pengguna siap berolahraga, mereka memilih misi di halaman Activity dan menekan Start. GPS Background Service merekam rute dan pace secara real-time, lalu memverifikasi data secara otomatis."*

### Layar 5: Profile
* **Komponen Visual:** Kartu Identitas Akun, Total akumulasi jarak/olahraga, Status Level & Rank Point, Badge pencapaian, Saldo Koin, serta Tombol *Top Up Coin* dengan integrasi payment gateway.
* **Narasi Pitch Demo:**
  > *"Di halaman Profile, pengguna dapat mengelola identitas akun, melihat riwayat aktivitas, serta memantau saldo koin untuk kebutuhan Top Up."*

---

## 7. PERANCANGAN BASIS DATA (DATABASE DESIGN)

Perancangan basis data didasarkan pada PostgreSQL (Supabase) dan diimplementasikan menggunakan Prisma ORM.

### Diagram Relasi Entitas (ERD)

```mermaid
erDiagram
    users ||--o{ groups : "creates"
    users ||--o{ group_members : "joins"
    groups ||--o{ group_members : "contains"
    groups ||--o{ missions : "hosts"
    users ||--o{ missions : "creates (creator_id)"
    users ||--o{ missions : "receives (target_user_id)"
    users ||--o{ activity_logs : "records"
    missions ||--o| activity_logs : "verifies with"
    users ||--o{ coin_transactions : "owns"

    users {
        uuid id PK
        string email
        string password_hash
        string name
        int coin_balance
        int rank_points
        timestamp created_at
    }

    groups {
        uuid id PK
        string name
        string invite_code UK "8 Karakter Unik"
        uuid created_by FK
        boolean is_premium
        timestamp created_at
    }

    group_members {
        uuid id PK
        uuid group_id FK
        uuid user_id FK
        string role "MEMBER / CAPTAIN"
        timestamp joined_at
    }

    missions {
        uuid id PK
        uuid group_id FK
        uuid creator_id FK
        uuid target_user_id FK "Bomb Target"
        string activity_type "RUNNING / CYCLING"
        float target_distance
        float target_max_pace
        int stakes_points
        string status "PENDING / ACCEPTED / COMPLETED / FAILED"
        timestamp deadline
    }

    activity_logs {
        uuid id PK
        uuid user_id FK
        uuid mission_id FK
        string activity_type
        float distance_meters
        int duration_seconds
        float average_pace
        jsonb route_geojson "Array Titik Koordinat GPS"
        timestamp started_at
        timestamp ended_at
    }

    coin_transactions {
        uuid id PK
        uuid user_id FK
        int amount "Positif (Top Up) / Negatif (Bomb)"
        string tx_type "TOP_UP / BOMB_STAKE / REFUND"
        string reference "ID Invoice Payment Gateway"
        timestamp created_at
    }
```

### Kamus Data Relasional

| Nama Tabel | Fungsi & Deskripsi Data | Kolom Utama | Relasi Kunci & Batasan |
| :--- | :--- | :--- | :--- |
| `users` | Identitas pengguna, kredensial autentikasi, rank point, dan saldo koin virtual. | `id`, `email`, `password_hash`, `name`, `coin_balance`, `rank_points` | **PK**: `id` (UUID). `email` Unique. |
| `groups` *(squads)* | Informasi grup privat (*Circle*) dan Kode Unik 8 Karakter (*Invite Code*). | `id`, `name`, `invite_code`, `created_by`, `is_premium` | **PK**: `id`. **FK**: `created_by` &rarr; `users.id`. `invite_code` Unique. |
| `group_members` | Tabel asosiasi relasi *many-to-many* antara pengguna dan grup privat. | `id`, `group_id`, `user_id`, `role`, `joined_at` | **Composite Key/Unique**: `(group_id, user_id)`. **FK**: `group_id`, `user_id`. |
| `missions` *(quests)* | Misi tantangan umum grup dan *Bomb Mission* spesifik target P2P. | `id`, `group_id`, `creator_id`, `target_user_id`, `stakes_points`, `deadline`, `status` | **PK**: `id`. **FK**: `group_id`, `creator_id`, `target_user_id`. |
| `activity_logs` | Rekam data GPS hasil olahraga (jarak, durasi, pace, dan titik rute). | `id`, `user_id`, `mission_id`, `distance_meters`, `duration_seconds`, `average_pace`, `route_geojson` | **PK**: `id`. **FK**: `user_id`, `mission_id`. Menggunakan JSONB untuk efisiensi koordinat rute. |
| `coin_transactions` | Riwayat mutasi keuangan virtual (Top Up koin & penggunaan Bomb Mission). | `id`, `user_id`, `amount`, `tx_type`, `reference`, `created_at` | **PK**: `id`. **FK**: `user_id` &rarr; `users.id`. |

---

## 8. ALGORITMA VERIFIKASI GPS & ANTI-CHEAT

Untuk menjaga integritas kompetisi pada ekosistem privat, backend dilengkapi dengan modul verifikasi otomatis:

1. **Pace & Speed Anomaly Threshold:**
   * Olahraga lari memiliki ambang batas kecepatan manusia normal (misal kecepatan maksimal tidak melebihi 2:30 min/km atau 24 km/jam).
   * Apabila kecepatan rata-rata atau akselerasi melampaui batas ini, sistem menandai aktivitas sebagai anomali (indikasi berkendara sepeda motor/mobil).

2. **Deteksi Teleportasi Koordinat (GPS Spoofing):**
   * Menghitung jarak antar titik koordinat berturutan menggunakan rumus **Haversine**:
     $$d = 2r \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta\phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta\lambda}{2}\right)}\right)$$
   * Jika $\Delta t$ (selisih waktu antar titik) sangat kecil namun jarak perpindahan $\Delta d$ sangat besar ($> 50 \text{ m/s}$), aktivitas otomatis digugurkan sebagai *Spoofed Coordinates*.

3. **Status Penyelesaian Misi:**
   * Misi dinyatakan `COMPLETED` hanya jika:
     * Jarak tercatat $\ge$ Target Jarak Misi.
     * Rata-rata pace $\le$ Batas Maksimal Pace Target.
     * Waktu selesai $\le$ Batas Waktu Misi (*Deadline*).
     * Lolos verifikasi algoritma *Anti-Cheat*.

---

## 9. BUSINESS MODEL CANVAS (BMC) & STRATEGI MONETISASI

```
+-----------------------------------------------------------------------------------------------------------------+
|                                          BUSINESS MODEL CANVAS (BMC) - CIDASH                                   |
+---------------------+---------------------+---------------------+-----------------------+-----------------------+
| KEY PARTNERS        | KEY ACTIVITIES      | VALUE PROPOSITIONS  | CUSTOMER              | CUSTOMER              |
|                     |                     |                     | RELATIONSHIPS         | SEGMENTS              |
| - Cloud Provider    | - Development &     | - Ruang privat aman | - Gamified Community  | - Geng Teman &        |
|   (Supabase/Vercel) |   Maintenance       |   (Kode 8 karakter) |   Engagement          |   Mahasiswa           |
| - Payment Gateway   |   (Flutter/NestJS/  | - Gamifikasi P2P    | - Automated Fair Play | - Pekerja Muda /      |
|   (Midtrans/Xendit) |   Python)           |   (Bomb Mission &   |   (Anti-Cheat)        |   Tim Kantor          |
| - OpenStreetMap /   | - Pengolahan &      |   Koin)             | - Seasonal Prestige & | - Pelari & Pesepeda   |
|   Leaflet Engine    |   Verifikasi GPS    | - Verifikasi GPS    |   Leaderboard Reset   |   Kasual              |
|                     | - Operasional Server|   otomatis          +-----------------------+                       |
|                     |   & Keamanan DB     | - Season Reset per  | CHANNELS              |                       |
|                     |                     |   3 bulan           |                       |                       |
|                     +---------------------+                     | - Mobile App (Flutter)|                       |
|                     | KEY RESOURCES       |                     | - Kode Undangan       |                       |
|                     |                     |                     |   (Viral Loop Referral|                       |
|                     | - Infrastruktur     |                     | - Media Sosial        |                       |
|                     |   Cloud & DB        |                     |   (TikTok/Instagram)  |                       |
|                     | - Tim Pengembang    |                     |                       |                       |
|                     |   (4 Orang)         |                     |                       |                       |
|                     | - Algoritma &       |                     |                       |                       |
|                     |   Source Code       |                     |                       |                       |
+---------------------+---------------------+---------------------+-----------------------+-----------------------+
| COST STRUCTURE                            | REVENUE STREAMS                                                     |
|                                           |                                                                     |
| - Biaya Infrastruktur Server Cloud & DB   | - Mikrotransaksi Koin (In-App Top Up via Midtrans/Xendit)           |
| - Biaya Fee Transaksi Payment Gateway     | - Item Digital / Shield Pass (Perlindungan hukuman Bomb Mission)    |
| - Biaya Operasional Pengembang & Pemasaran| - Subscription Premium Group (Fitur Circle tanpa batas anggota)     |
+-------------------------------------------+---------------------------------------------------------------------+
```

### Proyeksi Saluran Pendapatan (Revenue Streams Detail):
1. **Coin Top-Up Microtransactions:** Pembelian bundel koin untuk mengirimkan *Bomb Mission* kepada teman segrup (cth: Paket 100 Koin = Rp15.000, Paket 500 Koin = Rp65.000).
2. **Shield Pass / Shield Ticket:** Item pelindung khusus yang dapat dibeli dengan koin/uang tunai untuk membatalkan pinalti poin jika pengguna gagal menyelesaikan misi dadakan dari teman.
3. **Premium Circle Subscriptions:** Langganan bulanan bagi komunitas kantor atau kelompok besar untuk membuka fitur kustom, statistik mendalam, dan kapasitas anggota tanpa batas.

---

## 10. SPESIFIKASI REST API & KONTRAK DATA BACKEND

Berikut spesifikasi endpoint inti pada backend NestJS:

### Autentikasi (`/auth`)
* `POST /auth/register` — Registrasi akun baru (Email, Nama, Password).
* `POST /auth/login` — Autentikasi login, mengembalikan access token JWT.
* `GET /auth/me` — Mendapatkan profil pengguna yang sedang login (`JwtAuthGuard`).

### Circle / Squad (`/squads`)
* `POST /squads` — Membuat circle baru (menghasilkan Kode Unik 8 Karakter acak).
* `POST /squads/join` — Bergabung ke circle menggunakan kode 8 karakter (`inviteCode`).
* `GET /squads/my` — Mengambil daftar grup yang diikuti pengguna.
* `GET /squads/:id/leaderboard` — Mengambil ranking poin anggota circle untuk musim aktif.

### Quest / Bomb Mission (`/quests`)
* `POST /quests` — Membuat misi baru / mengirim *Bomb Mission* P2P ke teman satu circle.
* `GET /quests/active` — Mengambil seluruh misi aktif yang sedang berjalan di circle pengguna.
* `POST /quests/:id/shield` — Menggunakan *Shield Ticket* untuk menolak penalti misi.

### Activity Tracker (`/activities`)
* `POST /activities` — Mengirimkan log GPS yang telah direkam (jarak, durasi, pace, GeoJSON rute) untuk diverifikasi dan dicocokkan dengan misi aktif.
* `GET /activities/history` — Mengambil riwayat olahraga pengguna.

### Wallet & Koin (`/coins`)
* `GET /coins/balance` — Menampilkan saldo koin dan riwayat mutasi transaksi.
* `POST /coins/topup` — Membuka transaksi pembayaran top-up via Midtrans/Xendit.
* `POST /coins/webhook` — Webhook endpoint penerima konfirmasi pembayaran sukses dari gateway.

---

## 11. PANDUAN INSTALASI & EKSEKUSI PROYEK

### Prasyarat:
* Node.js v20+ & npm
* PostgreSQL 16+ (Lokal atau Supabase Cloud)
* Flutter SDK 3.20+ (Untuk modul Mobile)

### Langkah Menjalankan Backend (`backend/`):
```bash
# 1. Pindah ke direktori backend
cd backend

# 2. Pasang dependensi
npm install

# 3. Konfigurasi berkas .env
# Salin .env.example atau pastikan variabel terisi:
# DATABASE_URL="postgresql://user:pass@host:5432/cidash?schema=public"
# JWT_SECRET="your-super-secret-jwt-key"
# PORT=3000

# 4. Sinkronisasi Skema Database dengan Prisma
npx prisma generate
npx prisma db push

# 5. Jalankan backend dalam mode development
npm run start:dev
```
Backend akan aktif pada alamat: `http://localhost:3000`.

---

## 12. STATUS IMPLEMENTASI & CHECKLIST PENGERJAAN PROYEK

Tabel dan daftar periksa ini merefleksikan status implementasi aktual dari fitur-fitur yang ada di repositori per Oktober 2026:

### Ringkasan Status Global

| Domain / Pilar | Total Komponen | Selesai `[x]` | Belum `[ ]` | Progres |
| :--- | :---: | :---: | :---: | :---: |
| **A. Database & Prisma ORM** | 10 | 10 | 0 | 100% |
| **B. Backend API (NestJS)** | 16 | 13 | 3 | 81.3% |
| **C. Frontend Mobile (Flutter)** | 12 | 0 | 12 | 0% |
| **D. Algoritma GPS & Anti-Cheat** | 4 | 0 | 4 | 0% |
| **E. Pembayaran & Ekonomi Koin** | 5 | 0 | 5 | 0% |
| **F. Dokumentasi & Pitch Deck** | 5 | 5 | 0 | 100% |
| **TOTAL KESELURUHAN** | **52** | **28** | **24** | **53.8%** |

---

### A. Database & Skema (PostgreSQL / Supabase & Prisma ORM) — [SELESAI 100%]
- [x] Inisialisasi Prisma ORM dengan PostgreSQL provider (`prisma/schema.prisma`).
- [x] Model `User`: Manajemen identitas, kredensial hash, `coinBalance`, rank points, dan shield tickets.
- [x] Model `Squad`: Grup privat (*Circle*) dengan `inviteCode` unik 8 karakter dan relasi `createdBy`.
- [x] Model `SquadMember`: Relasi keanggotaan grup (*many-to-many*) dengan peran `MEMBER` dan `CAPTAIN`.
- [x] Model `Activity`: Log GPS (jarak meter, durasi detik, pace rata-rata, koordinat `routeGeoJson`).
- [x] Model `Quest`: Misi tantangan dan *Bomb Mission* P2P dengan `stakesPoints`, `deadline`, dan status.
- [x] Model `PointLedger` & `CoinTransaction`: Catatan transaksi perolehan/penalti poin serta mutasi koin virtual (Top Up & Biaya Misi).
- [x] Generasi Prisma Client TypeScript (`npx prisma generate`).
- [x] Penambahan field eksplisit `coinBalance` pada User (pemisahan saldo koin dan rank points sesuai PDF).
- [x] Berkas Seeding Data Awal (`prisma/seed.ts`) untuk demo akun, circle, dan misi contoh (berhasil di-seed ke Supabase).

---

### B. Backend API (NestJS)
#### 1. Autentikasi Pengguna (`/auth`) — [SELESAI]
- [x] Registrasi pengguna baru (`POST /auth/register`) dengan hashing password bcrypt.
- [x] Login pengguna (`POST /auth/login`) dengan penerbitan token JWT.
- [x] Proteksi rute berbasis JWT Guard (`JwtAuthGuard`, `JwtStrategy`).
- [x] Decorator `@CurrentUser()` untuk ekstraksi payload token.
- [x] Profil pengguna aktif (`GET /auth/me`).
- [x] Validasi payload DTO global (`ValidationPipe`).
- [x] Konfigurasi environment terpusat (`@nestjs/config`).

#### 2. Modul Lingkaran Pertemanan / Circle (`/squads`) — [SELESAI 100%]
- [x] Generator otomatis kode acak 8 karakter unik (misal: "RUN78XYZ").
- [x] Endpoint pembuatan Circle baru (`POST /squads`).
- [x] Endpoint bergabung ke Circle dengan kode 8 karakter (`POST /squads/join`).
- [x] Endpoint daftar Circle yang diikuti pengguna (`GET /squads/my`).
- [x] Endpoint Leaderboard harian & musiman per Circle (`GET /squads/:id/leaderboard`).
- [x] Endpoint manajemen anggota grup (Kick, Leave, transfer kepemimpinan Captain).

#### 3. Modul Quest & Bomb Mission (`/quests`) — [BELUM]
- [ ] Endpoint pengiriman *Bomb Mission* P2P ke teman satu grup (`POST /quests`).
- [ ] Validasi ketersediaan saldo koin pembuat tantangan saat misi dibuat.
- [ ] Endpoint daftar Active Missions di Circle pengguna (`GET /quests/active`).
- [ ] Endpoint penggunaan *Shield Ticket* untuk menolak penalti misi (`POST /quests/:id/shield`).
- [ ] Background Job / Cron untuk penandaan misi `FAILED` jika melewati *deadline*.

#### 4. Modul Perekaman Aktivitas GPS (`/activities`) — [BELUM]
- [ ] Endpoint submit log GPS (`POST /activities`) menerima jarak, durasi, pace, dan titik rute GeoJSON.
- [ ] Integrasi verifikasi otomatis anti-cheat sebelum aktivitas disetujui.
- [ ] Logika pencocokan otomatis antara aktivitas olahraga dengan misi aktif target pengguna.
- [ ] Distribusi Rank Point kepada pemenang/pembuat quest saat misi selesai.
- [ ] Endpoint riwayat aktivitas pengguna (`GET /activities/history`).

---

### C. Algoritma GPS & Anti-Cheat
- [ ] Algoritma validasi ambang batas kecepatan manusiawi (*Pace Anomaly Threshold*).
- [ ] Algoritma deteksi lonjakan koordinat / teleportasi (rumus Haversine & perbandingan $\Delta t$ terhadap $\Delta d$).
- [ ] Validasi rasio jarak terhadap waktu untuk mendeteksi penggunaan kendaraan bermotor saat lari.
- [ ] Layanan Python Microservice / modul terintegrasi untuk kalkulasi titik rute GPS.

---

### D. Sistem Pembayaran & Ekonomi Koin
- [ ] Endpoint cek saldo koin & riwayat mutasi transaksi koin (`GET /coins/balance`).
- [ ] Integrasi Payment Gateway (Midtrans Snap / Xendit Invoice) untuk top up koin (`POST /coins/topup`).
- [ ] Webhook endpoint penerima notifikasi status transaksi pembayaran (`POST /coins/webhook`).
- [ ] Endpoint pembelian item digital *Shield Ticket / Shield Pass* (`POST /coins/buy-shield`).
- [ ] Cron Job Season Reset setiap 3 bulan (arsip poin & reset papan peringkat kuartal).

---

### E. Frontend Mobile (Flutter)
- [ ] Inisialisasi struktur proyek Flutter (Clean Architecture / BLoC / Riverpod).
- [ ] Integrasi Dio / HTTP Client dengan interceptor token JWT.
- [ ] **Layar 1: Login & Onboarding** (Input email/password & input instan Kode 8 Karakter).
- [ ] **Layar 2: Dashboard** (Tampilan nama Circle, papan peringkat harian, dan ringkasan Active Missions).
- [ ] **Layar 3: Custom Quest** (Modal tantang teman P2P, input taruhan koin/Rank Point, pop-up animasi bom).
- [ ] **Layar 4: Activity Tracker** (Live GPS Map OpenStreetMap/Leaflet, kontrol Start/Finish, pace real-time).
- [ ] Integrasi *Background Geolocation Service* untuk tracking saat layar mati / terminasi sementara.
- [ ] **Layar 5: Profile & Koin** (Identitas pengguna, riwayat lari, badge, saldo koin, dan tombol Top Up).
- [ ] Integrasi SDK Payment Gateway UI / Webview untuk penyelesaian pembayaran Top Up.
- [ ] Animasi UI khusus (efek pop-up Bomb Mission, hitung mundur bom, dan animasi podium juara).

---

### F. Dokumentasi & Pitch Readiness — [SELESAI]
- [x] Dokumen Spesifikasi Teknis & Bisnis komprehensif (`docs/SPESIFIKASI_PROYEK_CIDASH.md`).
- [x] README utama repositori CiDash (`README.md`).
- [x] README teknis layanan backend (`backend/README.md`).
- [x] Skenario demo pitch 5 layar lengkap beserta naskah presenter.
- [x] Matriks Business Model Canvas (BMC) 9 blok & rencana monetisasi.

---
*Dokumen ini disusun dan distandarisasi untuk memenuhi persyaratan Kompetisi Business Plan & Pedoman Teknis Pengembangan Aplikasi Cidash.*
