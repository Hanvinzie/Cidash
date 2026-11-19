# Backlog revisi fitur (serah-terima antar sesi)

Dokumen ini memuat pekerjaan yang **belum** dikerjakan dari daftar revisi, lengkap dengan konteks kode, keputusan desain,
dan cara memverifikasinya, supaya bisa dilanjutkan di sesi lain tanpa membaca ulang percakapan.

Terakhir diperbarui pada versi aplikasi **0.2.2** (setelah poin 1–4 selesai). Branch kerja terakhir: `feat/live-circle-and-polish`.

## Cara bekerja di repo ini

- Monorepo npm workspaces: `frontend` (React + Vite + Tailwind v4, PWA) dan `backend` (NestJS + Prisma + PostgreSQL/Supabase).
- Setelah `git pull`: `npm install`, lalu `npm run prisma:generate`. Skema berubah di beberapa PR, jadi **terapkan migrasi
  di `backend/prisma/migrations/`** ke database (`npm run db:push`), kalau tidak endpoint quest/aktivitas akan 500.
- Typecheck frontend: `npm run typecheck --workspace frontend`. Backend: `cd backend && npx tsc --noEmit -p tsconfig.build.json`.
- Jest backend **tidak bisa jalan** di Node 22 (`@nestjs/testing` ESM). Verifikasi logika backend dengan skrip esbuild + Prisma tiruan.
- Komentar kode dan pesan commit: komentar Bahasa Indonesia, judul commit huruf kecil semua (konvensi repo).
- Satu aturan harga ada di DUA tempat dan harus identik: `backend/src/quests/quest-pricing.ts` dan `frontend/src/lib/questPricing.ts`.
  Satu codec polyline di dua tempat: `backend/src/common/utils/polyline.ts` dan `frontend/src/lib/polyline.ts`.

## Sudah selesai (jangan dikerjakan ulang)

Wordmark CIDASH, overview profil tidak terpotong, stakes Low/Medium/High bisa dipilih, kompas peta, label Recording/Demo dihapus,
mode simulasi tersembunyi (ketuk versi 7x di About), atribusi OpenFreeMap tertutup, demo mengikuti jalan GBK, zoom peta lebih dekat,
tombol fokus/peta di kanan bawah, onboarding + signin/signup baru (termasuk pop-up email belum terdaftar).

---
- Quest dan Activity terkunci bila belum punya circle (`NoCircleGate`; tidak terkunci saat memuat data atau saat merekam).
- Refresh otomatis: polling 25 dtk saat tab terlihat (`useAutoRefresh`, backoff, tanpa permintaan bertumpuk) + sinyal Realtime
  opsional `circle-events:<circleId>` (`useCircleEvents`, hanya memicu refresh, tanpa data).
- Pusat notifikasi (lonceng di header Profile menggantikan badge koin; titik merah di tab Profile). Logika di
  `frontend/src/lib/notifications.ts`, state di `AppContext`. Bug tab **Sent** diperbaiki: misi antar member lain tidak lagi tampil
  di Quests, hanya di notifikasi.
- Modal saran misi saat Start pada Free run/ride (`MissionSuggestModal`, maks 3 misi sejenis, "jangan tanya lagi" per sesi tab).

### Catatan implementasi notifikasi dan refresh

- Daftar notifikasi disimpan **per pengguna** (bukan per circle) supaya notifikasi "kamu di-kick dari X" tetap terlihat setelah circle itu
  hilang dari daftar. Snapshot dibuat per pengguna + circle. Snapshot pertama hanya garis dasar (tidak memunculkan notifikasi).
- Klien tidak bisa membedakan anggota yang keluar sendiri dan yang di-kick captain, jadi teksnya "is no longer in the circle". Kick
  terhadap **saya** terdeteksi saat circle hilang dari `/squads/my` dan bukan karena saya memanggil `leaveCircle`.
- `/quests/history` hanya berisi misi milik pengguna, jadi misi antar member lain hanya terlihat "hilang dari daftar aktif" dan
  diberi tahu sebagai "has ended" (hasil pasti tidak diketahui; bisa juga kedaluwarsa).
- Pengaturan: Bomb Mission alerts mengatur notifikasi bomb; "Circle activity" mengatur anggota baru/keluar dan pencapaian. Notifikasi
  kick selalu tampil.
- **Belum diuji di perangkat/browser nyata:** hanya typecheck, build, dan uji logika diff dengan skrip Node. Sinyal Realtime belum
  dicoba dengan proyek Supabase sungguhan. Nilai `isCreator` dipakai bila ada, fallback ke `creator.id`.
- Saran misi memakai `rewardRankPoints` hanya untuk Bomb Mission; circle mission belum punya hadiah (lihat #3 di bawah).

---

## Yang belum dikerjakan

### 1. Group run yang benar-benar berfungsi (poin 10)

**Masalah.** `frontend/src/services/groupRun.ts` hanya transport **tiruan di memori** (room seed `room_demo01`, bot peserta). Room tidak
dibagi antar pengguna, dan tidak ada tabel/endpoint group run di backend.

**Yang diminta.**
- Group run bekerja antar pengguna sungguhan.
- Tombol "Group run" di Home berubah: bila ada room berlangsung/lobby di circle, tampilkan **sedang berlangsung + tombol Join**;
  bila tidak ada, tampilkan **Buat room baru**.

**Desain yang disarankan (tanpa backend baru).** Implementasikan `GroupRunTransport` (interface sudah ada di `groupRun.ts`) di atas
Supabase Realtime: channel per circle (`group-rooms:<circleId>`) dengan **Presence** untuk mengiklankan room (host melacak
`{roomId, hostId, status}`), **Broadcast** untuk `join`/`leave`/`start`/`progress`, dan host sebagai otoritas state yang menyiarkan
`state` ke peserta. Interval progres sudah dikonstanta `PROGRESS_INTERVAL_MS` (5 dtk). Pilih transport lewat `isRealtimeConfigured`
(`frontend/src/services/supabase.ts`); tanpa Supabase pakai mock yang ada dan beri tahu pengguna bahwa itu demo.
Batasan yang harus didokumentasikan: bila host menutup aplikasi, room berakhir. Struktur kode agar mudah diuji: abstraksikan
`RealtimeHub` supaya dua transport bisa dihubungkan lewat hub di memori pada uji Node.

UI: `useLiveRooms` (di `frontend/src/hooks/useGroupRun.ts`) sudah menyediakan daftar room; ubah kartu "Group run" di
`frontend/src/screens/Dashboard.tsx`. Verifikasi: dua klien, A membuat room, B melihat tombol Join di Home dan bergabung, host
menekan Start, progres jarak saling terlihat, keluar/host pergi dibersihkan.

### 2. Tampilkan hadiah Rank Point di setiap circle mission (poin 11)

**Yang diminta.** Setiap circle mission menampilkan hadiah RP supaya pengguna bersemangat.

**Konteks kode dan peringatan.** `GroupMission` (`frontend/src/types/index.ts`) tidak punya field hadiah. Circle mission sekarang
**hanya data buatan di frontend** (`gm_daily_*`, `gm_weekly_*` dibuat di `AppContext.hydrateFromBackend`, dan `initialGroupMissions`
di `data/mock.ts`); **tidak ada di backend**. Bonus RP lokal di `recordActivity` (`+20`) akan **ditimpa** oleh nilai server setelah
POST, jadi RP yang ditampilkan tidak benar-benar dibayarkan. Pilihan:
- (cepat) tambah `rewardRankPoints` pada tipe + mock, tampilkan di kartu Dashboard dan daftar plan Activity, serta beri catatan
  bahwa ini masih demo; atau
- (benar) buat model `CircleMission` di backend (tabel, progres per anggota, penyelesaian memberi `PointLedger`) dan hubungkan.
Konfirmasikan pilihan dengan pemilik produk sebelum membuat model baru.

### 3. Diagnosis error server saat mengirim Bomb Mission (poin 5)

Bukan perubahan kode; perlu **konfirmasi dari log pemilik**. Dugaan utama: migrasi `20261118120000_quest_difficulty_and_wager`
(kolom `Quest.wagerCoins`, `Quest.difficulty`) belum diterapkan, sehingga Prisma gagal dan `AllExceptionsFilter` mengubahnya menjadi
"Terjadi kesalahan internal pada server". Minta pemilik membaca baris `[POST /quests] ...` di terminal backend (memuat pesan asli,
mis. `column ... does not exist`). Opsional: pada `NODE_ENV=development`, sertakan kode Prisma yang sudah disanitasi di respons 500
agar penyebabnya terlihat tanpa membuka log.

---

## Catatan teknis dan risiko yang diketahui

- **Realtime lokasi live** memakai channel publik (anon key) `circle-live:<circleId>`. Siapa pun yang tahu `circleId` bisa
  mendengarkan. Untuk produksi, pakai channel privat dengan JWT yang diterbitkan backend.
- Circle mission, group run, dan "achievement" saat ini tidak punya sumber kebenaran di backend (lihat #1 dan #2).
- Hapus quest dengan geser kiri hanya menyembunyikan di perangkat (`localStorage` per pengguna), bukan menghapus di server.
- Uji geser memakai mouse di Playwright; belum dicoba di layar sentuh asli. GPS, kompas, dan Wake Lock belum dicoba di perangkat fisik.
- Pemasangan update PWA di build produksi (service worker baru menunggu) belum diuji.
- `/auth/login` kini membedakan email tidak terdaftar (`code: EMAIL_NOT_REGISTERED`). `/auth/register` sudah lebih dulu membocorkan hal
  yang sama; batas 12 percobaan/menit pada login tetap berlaku.
