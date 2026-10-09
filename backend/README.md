# CiDash — Backend Service 🚀
> REST API, Authentication, and Business Logic Engine for **CiDash (Circle Dashboard)**.

Dibangun dengan **NestJS 12**, **Prisma ORM 5**, dan **PostgreSQL (Supabase)**.

---

## 🛠️ Tech Stack & Modul

* **Framework:** [NestJS](https://nestjs.com/) (Node.js + TypeScript)
* **ORM:** [Prisma ORM](https://prisma.io/)
* **Database:** PostgreSQL (Supabase)
* **Autentikasi:** Passport JWT (`@nestjs/jwt`, `passport-jwt`, `bcrypt`)
* **Validasi Data:** `class-validator` & `class-transformer`

---

## 🗄️ Model Basis Data (Prisma Schema)

Model Prisma di [`prisma/schema.prisma`](file:///D:/CiDash/backend/prisma/schema.prisma) dirancang selaras dengan spesifikasi proyek:

| Model Prisma | Tabel Spesifikasi | Deskripsi |
| :--- | :--- | :--- |
| `User` | `users` | Akun pengguna, password hash, coin balance, rank points, dan shield tickets. |
| `Squad` | `groups` | Circle privat pengguna dengan `inviteCode` unik (8 karakter) dan relasi pembuat. |
| `SquadMember` | `group_members` | Relasi keanggotaan *many-to-many* antara User dan Squad beserta perannya (`MEMBER`, `CAPTAIN`). |
| `Quest` | `missions` | Misi olahraga dan *Bomb Mission* P2P dengan taruhan poin (*stakesPoints*). |
| `Activity` | `activity_logs` | Log perekaman GPS: jarak meter, durasi detik, pace rata-rata, dan `routeGeoJson`. |
| `PointLedger` | `point_ledgers` | Buku besar perolehan dan penalti poin reputasi leaderboard. |
| `CoinTransaction` | `coin_transactions` | Catatan transaksi top up koin dan biaya misi P2P. |

---

## 🔌 Endpoint API Utama

### 1. Autentikasi (`/auth`)
* `POST /auth/register` — Mendaftarkan pengguna baru (`email`, `password`, `name`).
* `POST /auth/login` — Autentikasi dan penerbitan Bearer Token JWT.
* `GET /auth/me` — Membaca profil pengguna terotentikasi saat ini (*Protected by JWT Guard*).

### 2. Lingkaran Pertemanan / Circle (`/squads`)
* `POST /squads` — Membuat circle baru, generate kode 8 karakter unik, dan menetapkan pembuat sebagai `CAPTAIN`.
* `POST /squads/join` — Bergabung ke circle menggunakan kode undangan 8 karakter.
* `GET /squads/my` — Mengambil daftar circle yang diikuti beserta status peran dan jumlah misi.
* `GET /squads/:id/leaderboard` — Mengambil urutan peringkat anggota circle berdasarkan `rankPoints`.
* `GET /squads/:id` — Mengambil detail circle dan daftar anggota.
* `POST /squads/:id/leave` — Keluar dari circle (jika Captain keluar, kepemimpinan otomatis dialihkan ke anggota tertua).
* `DELETE /squads/:id/members/:userId` — Mengeluarkan anggota dari circle (khusus peran `CAPTAIN`).

### 3. Quest & Bomb Mission (`/quests`)
* `POST /quests` — Mengirimkan *Bomb Mission* P2P ke teman satu Circle (verifikasi dan pemotongan 20 koin pembuat).
* `GET /quests/active` — Daftar misi aktif dari Circle yang diikuti pengguna beserta sisa waktu hitung mundur.
* `POST /quests/:id/shield` — Menggunakan 1 *Shield Ticket* untuk membatalkan penalti misi (status menjadi `SHIELDED`).
* `POST /quests/:id/accept` — Menerima tantangan misi (status menjadi `ACCEPTED`).
* `GET /quests/:id` — Mengambil informasi detail dari suatu misi.
* `POST /quests/cron/expire-check` — Pemicu manual pengecekan misi kedaluwarsa (otomatis berjalan tiap jam via `@Cron`).

### 4. Aktivitas GPS (`/activities`) *(Dalam Pengembangan)*
* `POST /activities` — Mengirimkan hasil perekaman GPS untuk verifikasi anti-cheat dan penyelesaian misi.

---

## 💻 Panduan Menjalankan Backend

### Prasyarat:
* Node.js v20+ & npm
* PostgreSQL connection URL

### 1. Instalasi Dependensi
```bash
npm install
```

### 2. Pengaturan `.env`
Pastikan file `.env` sudah memuat variabel berikut:
```env
DATABASE_URL="postgresql://username:password@localhost:5432/cidash?schema=public"
JWT_SECRET="your-jwt-secret-key"
PORT=3000
```

### 3. Migrasi & Generate Prisma Client
```bash
npx prisma generate
npx prisma db push
```

### 4. Menjalankan Server
```bash
# Mode Development (Hot-Reload)
npm run start:dev

# Mode Production
npm run build
npm run start:prod
```

### 5. Testing & Code Quality
```bash
# Menjalankan Linter
npm run lint

# Menjalankan Unit Test
npm run test

# Menjalankan E2E Test
npm run test:e2e
```

---

## 📖 Dokumentasi Lengkap
Spesifikasi lengkap, skenario pitch demo, dan Business Model Canvas dapat diakses di:  
👉 [Dokumentasi Spesifikasi CiDash](../docs/SPESIFIKASI_PROYEK_CIDASH.md)
