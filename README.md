# CIDASH (Circle Dashboard) 🏃‍♂️💨
> **Social Gamified Fitness Tracker berbasis Pertemanan Privat (Invite-Only)**  

[![NestJS](https://img.shields.io/badge/Backend-NestJS%2012-ea2845?logo=nestjs&logoColor=white)](https://nestjs.com/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma%205-2D3748?logo=prisma&logoColor=white)](https://prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%20%2F%20Supabase-336791?logo=postgresql&logoColor=white)](https://supabase.com/)
[![Flutter](https://img.shields.io/badge/Mobile-Flutter-02569B?logo=flutter&logoColor=white)](https://flutter.dev/)
[![License](https://img.shields.io/badge/License-Proprietary-blue.svg)](#)

---

## 📖 Ringkasan Proyek

**Cidash** adalah aplikasi kebugaran interaktif yang dirancang khusus untuk mengatasi rasa canggung (*social anxiety*) berolahraga di platform sosial publik. Dengan Cidash, pengguna dapat berolahraga kasual bersama lingkaran pertemanan terpercaya menggunakan sistem **Circle Kode 8 Karakter**, saling menantang dengan mekanisme **P2P Bomb Mission** berbayar koin, serta bersaing secara sportif dengan **Season Reset berkala (3 bulan)**.

Untuk dokumentasi lengkap dan spesifikasi detail, silakan baca:
👉 **[Dokumen Spesifikasi Lengkap Proyek (docs/SPESIFIKASI_PROYEK_CIDASH.md)](file:///D:/CiDash/docs/SPESIFIKASI_PROYEK_CIDASH.md)**  
👉 **[Checklist Progres & Roadmap Pengerjaan (docs/CHECKLIST_PROGRES_PROYEK.md)](file:///D:/CiDash/docs/CHECKLIST_PROGRES_PROYEK.md)**

---

## ⚡ Fitur Utama

1. **Private Circle (Invite-Only):**
   * Masuk dan buat grup eksklusif hanya dengan membagikan 8 karakter kode unik.
   * Bebas dari rasa dihakimi publik atau perbandingan yang mengintimidasi.
2. **P2P Custom Quest & Bomb Mission:**
   * Kirim misi dadakan ke teman satu grup menggunakan koin virtual.
   * Taruhan poin peringkat (*Rank Points*) dengan batas waktu dan target pace realistis.
3. **Perekaman GPS & Verifikasi Otomatis:**
   * Pencatatan rute, jarak, dan rata-rata *pace* secara *real-time* dengan *Background GPS Service*.
   * Validasi anti-cheat untuk mendeteksi kecurangan (berkendara kendaraan bermotor atau manipulasi koordinat).
4. **Coin Economy & Shield Pass:**
   * Beli koin via payment gateway (Midtrans / Xendit).
   * Gunakan tiket perlindungan (*Shield Ticket*) untuk membatalkan pinalti misi.
5. **Papan Peringkat & Season Reset (3 Bulan):**
   * Reset peringkat berkala per kuartal guna menjaga motivasi seluruh anggota tetap tinggi.

---

## 🏗️ Arsitektur & Struktur Proyek

```
CiDash/
├── docs/
│   └── SPESIFIKASI_PROYEK_CIDASH.md   # Dokumen Lengkap Teknis & Bisnis
├── backend/                           # NestJS REST API & Prisma Engine
│   ├── src/
│   │   ├── auth/                      # Modul Autentikasi JWT & Guard
│   │   ├── database/                  # Modul Prisma & Database Service
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── prisma/
│   │   └── schema.prisma              # Skema Data PostgreSQL
│   ├── test/                          # Unit & E2E Testing
│   ├── package.json
│   └── README.md
└── D:\Cidash_Project_Document.pdf     # Dokumen Acuan Asli
```

---

## 👥 Tim & Struktur Peran

| Peran | Tanggung Jawab Utama |
| :--- | :--- |
| **Project Manager & Lead Backend** | Roadmap produk, alur gamifikasi, arsitektur database Supabase/PostgreSQL, algoritma verifikasi GPS & Anti-Cheat, integrasi payment gateway. |
| **Fullstack Developer** | Integrasi backend & frontend, REST API & Supabase Realtime, Row Level Security (RLS). |
| **Lead Frontend Developer (Mobile)** | Fondasi aplikasi Flutter, State Management, Background GPS Service, integrasi peta rute. |
| **Frontend Developer (UI/UX)** | Antarmuka interaktif, animasi pop-up Bomb Mission, papan peringkat (leaderboard), UX polish. |

---

## 🚀 Memulai (Quick Start Backend)

### 1. Masuk ke direktori backend
```bash
cd backend
```

### 2. Instal dependensi
```bash
npm install
```

### 3. Konfigurasi Environment (`.env`)
Pastikan variabel lingkungan telah terisi:
```env
DATABASE_URL="postgresql://postgres:[PASSWORD]@[HOST]:5432/[DB_NAME]?schema=public"
JWT_SECRET="cidash-super-secret-jwt-key"
PORT=3000
```

### 4. Sinkronisasi Database
```bash
npx prisma generate
npx prisma db push
```

### 5. Jalankan Server
```bash
npm run start:dev
```
Server backend akan berjalan di `http://localhost:3000`.

---

## 🌿 Panduan Branching & Commit (Git Best Practices)

Untuk menjaga repositori tetap bersih, rapi, dan mudah dikelola bersama tim, ikuti konvensi standar industri berikut:

### 1. Aturan Penamaan Branch (*Branch Naming Convention*)

Gunakan format: `<tipe>/<nama-singkat-fitur>` (gunakan huruf kecil dan tanda hubung `-` sebagai pemisah kata):

| Tipe Branch | Tujuan Penggunaan | Contoh Penamaan |
| :--- | :--- | :--- |
| `feat/` | Pengembangan fitur baru | `feat/squad-invite-code`, `feat/bomb-mission-p2p` |
| `fix/` | Perbaikan bug atau error | `fix/gps-haversine-calc`, `fix/auth-token-expiry` |
| `docs/` | Perubahan atau penambahan dokumentasi | `docs/api-specification`, `docs/setup-guide` |
| `refactor/` | Perapihan struktur kode tanpa mengubah fungsi | `refactor/prisma-service`, `refactor/dto-validation` |
| `test/` | Penambahan atau perbaikan unit test / e2e | `test/auth-controller`, `test/quest-service` |
| `chore/` | Pemeliharaan dependensi, konfigurasi, build tool | `chore/update-deps`, `chore/setup-eslint` |

---

### 2. Standar Pesan Commit (*Conventional Commits*)

Gunakan struktur:  
`git commit -m "<tipe>(<lingkup>): <deskripsi singkat perubahan>"`

* **Contoh Commit yang Baik & Rapi:**
  * `feat(squad): implement 8-char invite code generator`
  * `feat(quest): add bomb mission creation endpoint with coin check`
  * `fix(gps): resolve speed spike anomaly on running mode`
  * `docs(readme): add git branching and commit conventions`
  * `refactor(auth): simplify jwt payload extraction`
  * `test(auth): add unit test for register and login service`

* 💡 **Tips Commit Rapi:**
  * **Atomik:** Commit satu tugas/fitur kecil dalam satu waktu, jangan menumpuk banyak perubahan acak di satu commit.
  * **Jelas:** Hindari pesan ambigu seperti *"update"*, *"fix bug"*, atau *"test"*.
  * **Imperatif:** Gunakan kata kerja aktif (misal: `add`, `update`, `fix`, `remove`).

---

### 3. Alur Kerja (Workflow) dari Pembuatan Branch hingga Merge

Ikuti tahapan 7 langkah ini setiap kali mengerjakan tugas baru:

```bash
# 1. Pastikan branch main lokal dalam kondisi terbaru
git checkout main
git pull origin main

# 2. Buat branch baru dan langsung berpindah ke dalamnya
git checkout -b feat/nama-fitur-baru
# (atau alternatif modern: git switch -c feat/nama-fitur-baru)

# 3. Lakukan pengodean / perubahan file...

# 4. Periksa file yang telah diubah
git status

# 5. Masukkan file ke staging area
git add .
# atau spesifik: git add src/squads/

# 6. Buat commit dengan pesan terstruktur
git commit -m "feat(squad): create circle and assign captain role"

# 7. Unggah branch ke GitHub
git push -u origin feat/nama-fitur-baru
```

Setelah di-push ke GitHub:
1. Buka repositori di browser GitHub.
2. Buat **Pull Request (PR)** dari branch Anda (`feat/nama-fitur-baru`) menuju `main`.
3. Setelah di-review dan lolos test, lakukan **Merge PR** ke branch `main`.
4. Hapus branch fitur di GitHub jika sudah di-merge.

---

## 📄 Referensi Dokumen
* **Spesifikasi Teknis & Business Model Canvas:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](file:///D:/CiDash/docs/SPESIFIKASI_PROYEK_CIDASH.md)
* **Checklist Progres & Roadmap Pengerjaan:** [docs/CHECKLIST_PROGRES_PROYEK.md](file:///D:/CiDash/docs/CHECKLIST_PROGRES_PROYEK.md)
* **Dokumen Acuan:** `D:\Cidash_Project_Document.pdf`

