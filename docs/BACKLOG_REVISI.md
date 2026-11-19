# Backlog revisi fitur (serah-terima antar sesi)

Dokumen ini memuat pekerjaan yang **belum** dikerjakan dari daftar revisi, lengkap dengan konteks kode, keputusan desain,
dan cara memverifikasinya, supaya bisa dilanjutkan di sesi lain tanpa membaca ulang percakapan.

Terakhir diperbarui pada versi aplikasi **0.2.2**. Branch kerja terakhir: `feat/live-circle-and-polish`.

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

## Yang belum dikerjakan

### 1. Quest dan Activity terkunci bila belum punya circle (PRIORITAS TINGGI)

**Masalah.** Pengguna tanpa circle (mis. akun baru yang menekan "Skip for now") masih bisa membuka tab Quests dan Activity, yang
isinya tidak berfungsi tanpa circle.

**Yang diminta.** Bila `circles.length === 0`, tab **Quests** dan **Activity** terkunci dan pengguna diminta **membuat atau bergabung**
ke circle.

**Panduan.**
- Sumber data: `useApp().circles` / `activeCircle` di `frontend/src/store/AppContext.tsx`. Hati-hati dengan state `hydrating`
  (jangan tampilkan kunci sebelum data selesai dimuat, atau layar berkedip).
- Buat komponen `NoCircleGate` (ikon, penjelasan singkat, tombol "Create or join a circle" yang membuka `circleOnboarding` dari
  `frontend/src/routes.ts`). Bungkus isi `CustomQuest` dan `Activity`. Jangan menyembunyikan tab di nav (pengguna harus tahu fiturnya ada).
- Dashboard sudah punya kartu "No circle yet"; samakan gaya dan teksnya.
- Rekaman aktif (`useIsRecording`) tidak boleh terkunci kalau circle hilang di tengah lari (mis. di-kick).
- Verifikasi: akun tanpa circle melihat gate di Quests dan Activity, tombolnya membuka halaman join, setelah join gate hilang tanpa reload.

### 2. Refresh otomatis data circle (poin 4)

**Masalah.** Aplikasi hanya memuat data saat dibuka (`hydrateFromBackend`) atau setelah aksi pengguna sendiri. Tidak ada
`setInterval` maupun listener `visibilitychange` di `AppContext`. Member baru, bomb mission baru, hasil mission, dan kick baru terlihat
setelah aplikasi dibuka ulang.

**Yang diminta.** Pembaruan otomatis saat memakai database sungguhan.

**Desain yang disarankan (dua lapis, tanpa mengubah backend).**
1. **Polling** di `AppContext`: saat tab terlihat, panggil ulang `syncCircleLeaderboard`, `syncQuests`, dan data `/auth/me` setiap
   ±20–30 detik, dan langsung saat `visibilitychange` menjadi `visible` atau `online`. Hentikan saat tab tersembunyi. Pakai satu
   timer, hindari permintaan bertumpuk (flag `inFlight`), dan backoff saat gagal.
2. **Sinyal Realtime (opsional, bila `VITE_SUPABASE_*` terisi).** Setelah aksi yang mengubah circle (join, leave, kick, kirim/terima/
   shield bomb, selesai aktivitas), klien menyiarkan event ringan `circle_changed` ke channel `circle-events:<circleId>` (pola sama
   dengan `frontend/src/hooks/useLiveCircleChannel.ts`). Klien lain cukup memicu refresh; event **tidak membawa data**, jadi aman
   walau dipalsukan (paling buruk hanya refresh ekstra; beri rate limit sisi klien).
3. Jangan memakai `postgres_changes`: tabel di-hardening RLS (`backend/prisma/security-hardening.sql`), jadi anon tidak bisa membacanya.

**Verifikasi.** Dua klien dalam circle yang sama: klien A menerima member baru / bomb dalam ≤ interval polling tanpa reload. Pastikan
tidak ada permintaan saat tab di background dan tidak ada badai permintaan saat offline.

### 3. Pusat notifikasi menggantikan badge koin di header Profile (poin 12)

**Yang diminta.** Hilangkan badge koin di atas halaman Profile, ganti dengan **tombol notifikasi** (lonceng). Isi notifikasi:
- progres/pencapaian baru setiap member,
- siapa yang diberi Bomb Mission (dan oleh siapa),
- jika ada yang di-kick, termasuk jika **pengguna sendiri** di-kick.

**Konteks kode.**
- Badge koin ada di `frontend/src/components/layout/AppLayout.tsx` (link `profileTopUp`). Ganti **hanya di halaman Profile**; di tab lain
  badge koin tetap (usulan, konfirmasikan). Titik merah di tab Profile bisa menggabungkan update-app + notifikasi belum dibaca
  (`UpdateDot` di AppLayout).
- Tidak ada konsep notifikasi/achievement di backend. Turunkan di klien dengan membandingkan snapshot sebelum/sesudah polling
  (bergantung pada tugas #2), simpan snapshot dan daftar notifikasi di `localStorage` per pengguna + circle, ID deterministik agar
  tidak dobel, tandai "terakhir dilihat" untuk hitungan belum dibaca. Simpan maksimum ±50 item.
- Jenis event: `member_joined`, `member_left`, `kicked` (saya hilang dari daftar circle setelah hydrate; bedakan dari leave yang saya
  lakukan sendiri), `bomb_received`, `bomb_sent_to_other` (misi antar member lain), `bomb_result` (shielded/failed/completed),
  `milestone` (total km 10/25/50/100, RP 500/1000/2000, naik ke #1).
- **Bug yang ditemukan, perlu diperbaiki bersamaan:** `syncQuests` di AppContext memetakan `direction: q.isTargetUser ? 'incoming' : 'sent'`.
  `GET /quests/active` mengembalikan SEMUA misi aktif di circle, jadi misi antar member lain ikut tampil di tab **Sent** pengguna.
  Gunakan `isCreator` untuk `sent`, dan pisahkan misi orang lain ke feed notifikasi.
- Pengaturan notifikasi sudah ada di Settings (`cidash_notif_bomb`, `cidash_notif_group`); hormati keduanya.
- Verifikasi: tiap jenis event muncul sekali, hitungan belum dibaca benar, membuka panel menandai terbaca, state persisten setelah reload.

### 4. Modal "sekalian kerjakan?" saat menekan Start pada Free run (poin 8)

**Yang diminta.** Saat pengguna menekan Start pada mode **Free run/ride** dan ada circle mission yang belum selesai dan **sejenis**
(lari/sepeda sama), tampilkan modal dulu: "Tidak sekalian kerjakan?", daftar misi terkait, dan pilihan "Tidak, free run saja".

**Konteks kode.** `handleStart` di `frontend/src/screens/Activity.tsx`. Misi terbuka: `groupMissions.filter(status !== 'completed')`
dan bomb mission masuk `in_progress`. Pilih misi → set parameter URL `mission` lalu mulai (gunakan `selectPlan`). Tampilkan paling
banyak 3 misi, tiap baris menampilkan target km dan hadiah RP (lihat #6). Jangan tampilkan modal untuk plan non-free atau saat
tidak ada misi terkait. Pertimbangkan "jangan tanya lagi di sesi ini" bila pengguna menolak.

### 5. Group run yang benar-benar berfungsi (poin 10)

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

### 6. Tampilkan hadiah Rank Point di setiap circle mission (poin 11)

**Yang diminta.** Setiap circle mission menampilkan hadiah RP supaya pengguna bersemangat.

**Konteks kode dan peringatan.** `GroupMission` (`frontend/src/types/index.ts`) tidak punya field hadiah. Circle mission sekarang
**hanya data buatan di frontend** (`gm_daily_*`, `gm_weekly_*` dibuat di `AppContext.hydrateFromBackend`, dan `initialGroupMissions`
di `data/mock.ts`); **tidak ada di backend**. Bonus RP lokal di `recordActivity` (`+20`) akan **ditimpa** oleh nilai server setelah
POST, jadi RP yang ditampilkan tidak benar-benar dibayarkan. Pilihan:
- (cepat) tambah `rewardRankPoints` pada tipe + mock, tampilkan di kartu Dashboard dan daftar plan Activity, serta beri catatan
  bahwa ini masih demo; atau
- (benar) buat model `CircleMission` di backend (tabel, progres per anggota, penyelesaian memberi `PointLedger`) dan hubungkan.
Konfirmasikan pilihan dengan pemilik produk sebelum membuat model baru.

### 7. Diagnosis error server saat mengirim Bomb Mission (poin 5)

Bukan perubahan kode; perlu **konfirmasi dari log pemilik**. Dugaan utama: migrasi `20261118120000_quest_difficulty_and_wager`
(kolom `Quest.wagerCoins`, `Quest.difficulty`) belum diterapkan, sehingga Prisma gagal dan `AllExceptionsFilter` mengubahnya menjadi
"Terjadi kesalahan internal pada server". Minta pemilik membaca baris `[POST /quests] ...` di terminal backend (memuat pesan asli,
mis. `column ... does not exist`). Opsional: pada `NODE_ENV=development`, sertakan kode Prisma yang sudah disanitasi di respons 500
agar penyebabnya terlihat tanpa membuka log.

---

## Catatan teknis dan risiko yang diketahui

- **Realtime lokasi live** memakai channel publik (anon key) `circle-live:<circleId>`. Siapa pun yang tahu `circleId` bisa
  mendengarkan. Untuk produksi, pakai channel privat dengan JWT yang diterbitkan backend.
- Circle mission, group run, dan "achievement" saat ini tidak punya sumber kebenaran di backend (lihat #5 dan #6).
- Hapus quest dengan geser kiri hanya menyembunyikan di perangkat (`localStorage` per pengguna), bukan menghapus di server.
- Uji geser memakai mouse di Playwright; belum dicoba di layar sentuh asli. GPS, kompas, dan Wake Lock belum dicoba di perangkat fisik.
- Pemasangan update PWA di build produksi (service worker baru menunggu) belum diuji.
- `/auth/login` kini membedakan email tidak terdaftar (`code: EMAIL_NOT_REGISTERED`). `/auth/register` sudah lebih dulu membocorkan hal
  yang sama; batas 12 percobaan/menit pada login tetap berlaku.
