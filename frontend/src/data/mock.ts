import type {
  ActivityLog,
  BombMission,
  Circle,
  CoinPackage,
  GeoPoint,
  GroupMission,
  LeaderboardEntry,
  User,
} from '../types';

// ============================================================
// Mock data prototype — ganti dengan data dari REST API backend.
// Dibaca sekali oleh AppContext sebagai state awal.
// ============================================================

export const initialUser: User = {
  id: 'usr_001',
  username: 'rivaldo',
  rankPoints: 1240,
  coins: 85,
};

export const initialCircles: Circle[] = [
  { id: 'cir_001', name: 'Sunset Run Squad', code: '8KZA1B2C', memberCount: 5 },
  { id: 'cir_002', name: 'Weekend Riders', code: 'QW9R4T7Y', memberCount: 3 },
];

/** Anggota per circle (tidak termasuk user saat ini). */
export const circleMembers: Record<string, Pick<User, 'id' | 'username'>[]> = {
  cir_001: [
    { id: 'usr_002', username: 'dika' },
    { id: 'usr_003', username: 'rani' },
    { id: 'usr_004', username: 'bagas' },
    { id: 'usr_005', username: 'intan' },
  ],
  cir_002: [
    { id: 'usr_004', username: 'bagas' },
    { id: 'usr_006', username: 'yoga' },
  ],
};

/** Leaderboard season per circle (tanpa user saat ini — digabung di AppContext). */
export const leaderboardByCircle: Record<string, Omit<LeaderboardEntry, 'rank'>[]> = {
  cir_001: [
    { user: { id: 'usr_002', username: 'dika' }, rankPoints: 1540, totalDistanceKm: 72.4 },
    { user: { id: 'usr_003', username: 'rani' }, rankPoints: 1100, totalDistanceKm: 55.8 },
    { user: { id: 'usr_004', username: 'bagas' }, rankPoints: 980, totalDistanceKm: 48.2 },
    { user: { id: 'usr_005', username: 'intan' }, rankPoints: 760, totalDistanceKm: 31.0 },
  ],
  cir_002: [
    { user: { id: 'usr_006', username: 'yoga' }, rankPoints: 1310, totalDistanceKm: 140.5 },
    { user: { id: 'usr_004', username: 'bagas' }, rankPoints: 980, totalDistanceKm: 98.2 },
  ],
};

export const initialGroupMissions: GroupMission[] = [
  { id: 'gm_001', circleId: 'cir_001', title: '3 KM Circle Run', type: 'run', targetKm: 3, progressKm: 1.8, deadline: 'Today 9:00 PM', status: 'in_progress', cadence: 'daily' },
  { id: 'gm_002', circleId: 'cir_001', title: '15 KM Weekly Challenge', type: 'run', targetKm: 15, progressKm: 9.4, deadline: 'in 3 days', status: 'in_progress', cadence: 'weekly' },
  { id: 'gm_003', circleId: 'cir_002', title: 'Easy 10 KM Ride', type: 'bike', targetKm: 10, progressKm: 4.2, deadline: 'Sunday 9:00 AM', status: 'in_progress', cadence: 'weekly' },
];

export const initialBombMissions: BombMission[] = [
  { id: 'bm_001', direction: 'incoming', counterpart: { id: 'usr_002', username: 'dika' }, type: 'run', targetKm: 3, durationMin: 25, deadline: 'Today 6:59 PM', wagerCoins: 20, rewardRankPoints: 40, penaltyRankPoints: 20, status: 'pending' },
  { id: 'bm_002', direction: 'incoming', counterpart: { id: 'usr_003', username: 'rani' }, type: 'run', targetKm: 2, durationMin: 13, deadline: 'Tomorrow 7:00 AM', wagerCoins: 15, rewardRankPoints: 30, penaltyRankPoints: 15, status: 'pending' },
  { id: 'bm_003', direction: 'sent', counterpart: { id: 'usr_004', username: 'bagas' }, type: 'bike', targetKm: 8, durationMin: 30, deadline: 'Today 8:00 PM', wagerCoins: 25, rewardRankPoints: 50, penaltyRankPoints: 25, status: 'in_progress' },
];

/** Rute sintetis berbentuk loop (~km) untuk mock riwayat. Ganti dengan rute dari GET /activities/history. */
function mockLoopRoute(center: { lat: number; lng: number }, km: number, seed: number): GeoPoint[] {
  const n = 60;
  const r = km / (2 * Math.PI) / 111; // radius dalam derajat (~111 km/derajat)
  const start = Date.UTC(2026, 9, 15, 23, 0) + seed * 86_400_000;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * 2 * Math.PI;
    const wobble = 1 + 0.25 * Math.sin(3 * t + seed);
    return {
      lat: center.lat + r * wobble * Math.sin(t),
      lng: center.lng + (r * wobble * Math.cos(t) * (1 + 0.4 * Math.sin(seed))) / Math.cos((center.lat * Math.PI) / 180),
      timestamp: start + i * 30_000,
    };
  });
}

const squad1 = { name: 'Sunset Run Squad', code: '8KZA1B2C' };

export const initialActivityHistory: ActivityLog[] = [
  { id: 'act_001', type: 'run', mode: 'group', distanceKm: 5.2, durationSec: 1900, date: 'Oct 19, 2026', routeLabel: 'GBK Loop', missionStatus: 'completed', route: mockLoopRoute({ lat: -6.2183, lng: 106.8022 }, 5.2, 1), circle: squad1 },
  { id: 'act_002', type: 'bike', mode: 'solo', distanceKm: 12.8, durationSec: 2892, date: 'Oct 17, 2026', routeLabel: 'Sudirman — Kuningan', missionStatus: 'completed', route: mockLoopRoute({ lat: -6.2146, lng: 106.8227 }, 12.8, 2), circle: { name: 'Weekend Riders', code: 'QW9R4T7Y' } },
  { id: 'act_003', type: 'run', mode: 'solo', distanceKm: 2.1, durationSec: 845, date: 'Oct 15, 2026', routeLabel: 'Bomb from dika', missionStatus: 'failed', route: mockLoopRoute({ lat: -6.2297, lng: 106.8 }, 2.1, 3), circle: squad1 },
];

export const coinPackages: CoinPackage[] = [
  { id: 'cp_001', coins: 50, priceLabel: 'Rp15,000' },
  { id: 'cp_002', coins: 120, priceLabel: 'Rp30,000', bonusCoins: 10 },
  { id: 'cp_003', coins: 300, priceLabel: 'Rp70,000', bonusCoins: 40 },
];
