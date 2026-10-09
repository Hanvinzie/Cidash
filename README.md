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

## 📄 Referensi Dokumen
* **Spesifikasi Teknis & Business Model Canvas:** [docs/SPESIFIKASI_PROYEK_CIDASH.md](file:///D:/CiDash/docs/SPESIFIKASI_PROYEK_CIDASH.md)
* **Dokumen Acuan:** `D:\Cidash_Project_Document.pdf`
