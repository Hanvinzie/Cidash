// ============================================================
// Tipe data domain Cidash (prototype — selaras skema backend)
// ============================================================

export type ActivityType = 'run' | 'bike';

export type MissionStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'pending';

export type QuestDirection = 'incoming' | 'sent';

export interface User {
  id: string;
  username: string;
  avatarUrl?: string;
  rankPoints: number;
  coins: number;
}

export interface Circle {
  id: string;
  name: string;
  code: string; // kode unik 8 karakter
  memberCount: number;
}

export interface LeaderboardEntry {
  rank: number;
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  rankPoints: number;
  totalDistanceKm: number;
}

export interface GroupMission {
  id: string;
  circleId: string;
  title: string;
  type: ActivityType;
  targetKm: number;
  progressKm: number;
  deadline: string; // ISO atau label singkat
  status: MissionStatus;
  cadence: 'daily' | 'weekly';
}

export interface BombMission {
  id: string;
  direction: QuestDirection;
  counterpart: Pick<User, 'id' | 'username'>; // pengirim (incoming) / target (sent)
  type: ActivityType;
  targetKm: number;
  durationMin: number;
  deadline: string;
  wagerCoins: number;
  rewardRankPoints: number;
  penaltyRankPoints: number;
  status: MissionStatus;
}

export type RunMode = 'solo' | 'group';

export interface ActivityLog {
  id: string;
  type: ActivityType;
  mode: RunMode;
  distanceKm: number;
  durationSec: number;
  date: string;
  routeLabel: string; // label rute / misi
  missionStatus: MissionStatus;
  route: GeoPoint[]; // untuk render ulang Social Track Map Card
  circle: Pick<Circle, 'name' | 'code'> | null; // snapshot saat aktivitas direkam
}

export interface CoinPackage {
  id: string;
  coins: number;
  priceLabel: string;
  bonusCoins?: number;
}

export interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number; // ms
}

export interface VerificationResult {
  valid: boolean;
  reason?: string;
  distanceKm: number;
  durationSec: number;
  rankPointsDelta: number;
  missionStatus?: MissionStatus;
  log?: ActivityLog; // ada jika valid — dipakai Share Card
}

// ---------------- Group Run (Synchronous Session) ----------------

export type GroupRunStatus = 'lobby' | 'live' | 'ended';

export interface GroupRunParticipant {
  userId: string;
  username: string;
  distanceKm: number;
  lastPoint?: GeoPoint;
  updatedAt: number;
}

export interface GroupRunRoom {
  id: string; // room_id
  circleId: string;
  hostId: string;
  hostName: string;
  status: GroupRunStatus;
  startedAt?: number;
  participants: GroupRunParticipant[];
}

/** Payload yang dikirim tiap client secara periodik (setiap 5 detik). */
export interface GroupRunProgress {
  roomId: string;
  userId: string;
  distanceKm: number;
  point?: GeoPoint;
}
