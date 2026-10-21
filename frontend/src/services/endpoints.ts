// ============================================================
// Kontrak endpoint antara frontend & backend NestJS.
// [ADA] = sudah ada di backend/src   [BELUM] = belum ada, perlu dibuat di backend
// "Circle" di UI = "Squad" di backend.
// ============================================================

export const ENDPOINTS = {
  auth: {
    register: 'POST /auth/register', // [ADA]
    login: 'POST /auth/login', // [ADA] -> { accessToken }
    me: 'GET /auth/me', // [ADA]
    google: 'POST /auth/google', // [BELUM] OAuth Google
  },
  circles: {
    create: 'POST /squads', // [ADA]
    join: 'POST /squads/join', // [ADA] body: { code }
    mine: 'GET /squads/my', // [ADA]
    detail: 'GET /squads/:id', // [ADA]
    leaderboard: 'GET /squads/:id/leaderboard', // [ADA] juga sumber daftar anggota (berisi role CAPTAIN/MEMBER)
    leave: 'POST /squads/:id/leave', // [ADA]
    missions: 'GET /squads/:id/missions', // [BELUM] misi harian/mingguan grup
  },
  quests: {
    create: 'POST /quests', // [ADA] bomb mission (target_user_id, wager)
    active: 'GET /quests/active', // [ADA] incoming + sent
    accept: 'POST /quests/:id/accept', // [ADA]
    shield: 'POST /quests/:id/shield', // [ADA]
    reject: 'POST /quests/:id/reject', // [BELUM]
  },
  activities: {
    create: 'POST /activities', // [ADA] backend memverifikasi Haversine + anti-cheat
    history: 'GET /activities/history', // [ADA] perlu menyertakan `route` untuk Share Card
    detail: 'GET /activities/:id', // [ADA]
  },
  wallet: {
    packages: 'GET /wallet/packages', // [BELUM]
    topUp: 'POST /wallet/top-up', // [BELUM] -> URL/token Payment Gateway (Midtrans/Xendit)
    webhook: 'POST /wallet/webhook', // [BELUM] dipanggil Payment Gateway
  },
  groupRun: {
    list: 'GET /group-runs?circleId=', // [BELUM] room aktif di circle
    create: 'POST /group-runs', // [BELUM] -> { room_id }
    join: 'POST /group-runs/:id/join', // [BELUM]
    start: 'POST /group-runs/:id/start', // [BELUM] host only
    leave: 'POST /group-runs/:id/leave', // [BELUM]
    // Realtime: channel `group_run:<room_id>`, event `progress` (GroupRunProgress) tiap 5 detik,
    // server broadcast `state` (GroupRunRoom). Lihat services/groupRun.ts.
  },
} as const;
