// ============================================================
// Kontrak endpoint antara frontend & backend NestJS.
// [ADA] = sudah ada di backend/src & terhubung ke AppContext
// "Circle" di UI = "Squad" di backend.
// ============================================================

export const ENDPOINTS = {
  auth: {
    register: 'POST /auth/register', // [ADA]
    login: 'POST /auth/login', // [ADA] -> { accessToken, user }
    me: 'GET /auth/me', // [ADA]
    topUp: 'POST /auth/top-up', // [ADA] tambah saldo koin + catat CoinTransaction
  },
  circles: {
    create: 'POST /squads', // [ADA]
    join: 'POST /squads/join', // [ADA] body: { inviteCode }
    mine: 'GET /squads/my', // [ADA]
    detail: 'GET /squads/:id', // [ADA]
    leaderboard: 'GET /squads/:id/leaderboard', // [ADA] menyertakan totalDistanceKm
    leave: 'POST /squads/:id/leave', // [ADA]
  },
  quests: {
    create: 'POST /quests', // [ADA] bomb mission (targetUserId, stakesPoints, dll)
    active: 'GET /quests/active', // [ADA] incoming + sent
    accept: 'POST /quests/:id/accept', // [ADA]
    shield: 'POST /quests/:id/shield', // [ADA]
    reject: 'POST /quests/:id/reject', // [ADA] pakai shield jika ada atau failed
  },
  activities: {
    create: 'POST /activities', // [ADA] backend memverifikasi Haversine + anti-cheat
    history: 'GET /activities/history', // [ADA] menyertakan routeGeoJson untuk Share Card
    detail: 'GET /activities/:id', // [ADA]
  },
} as const;
