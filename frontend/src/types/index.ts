// ============================================================
// Tipe data domain Cidash (prototype — selaras skema backend)
// ============================================================

export type ActivityType = 'run' | 'bike';

export type MissionStatus =
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'pending'
  | 'shielded';

export type QuestDirection = 'incoming' | 'sent';

export type AvailabilityStatus = 'AVAILABLE' | 'IN_MISSION' | 'RESTING';

export interface User {
  id: string;
  username: string;
  email?: string;
  avatarUrl?: string;
  /** Tanggal daftar (ISO). */
  createdAt?: string;
  rankPoints: number;
  coins: number;
  shieldTickets?: number;
  availabilityStatus?: AvailabilityStatus;
  restUntil?: string | null;
  weeklyShieldsBought?: number;
  maxWeeklyShields?: number;
  maxShieldTickets?: number;
  nextShieldCost?: number | null;
  weeklyRestUsed?: number;
  maxWeeklyRest?: number;
  nextRestCost?: number | null;
}

/** Total sepanjang masa dari server (bukan hanya 25 aktivitas terakhir yang dimuat). */
export interface ActivitySummary {
  workouts: number;
  distanceKm: number;
  durationMinutes: number;
}

export interface Circle {
  id: string;
  name: string;
  code: string; // kode unik 8 karakter
  memberCount: number;
  maxMembers?: number; // 5 (Free) atau 25 (Premium)
  isPremium?: boolean;
  captainId?: string; // pembuat circle (role CAPTAIN di backend)
}

export interface CircleMember extends Pick<User, 'id' | 'username'> {
  role: 'captain' | 'member';
  isMe: boolean;
  rankPoints: number;
  totalDistanceKm: number;
  shieldTickets?: number;
  availabilityStatus?: AvailabilityStatus;
  restUntil?: string | null;
}

export interface LeaderboardEntry {
  rank: number;
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  rankPoints: number;
  totalDistanceKm: number;
  availabilityStatus?: AvailabilityStatus;
  restUntil?: string | null;
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
  snoozed?: boolean;
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
  locationLabel?: string | null; // hasil reverse geocoding sekali saat Finish (mis. "Senayan, Jakarta")
  elevationGain?: number; // meter
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
  accuracy?: number; // radius akurasi GPS dalam meter
  speed?: number | null; // m/s dari sensor GPS jika tersedia
  heading?: number | null; // arah gerak (derajat dari utara) dari sensor GPS jika tersedia
  altitude?: number | null; // meter di atas permukaan laut jika tersedia
  altitudeAccuracy?: number | null;
  /** true = titik pertama setelah jeda yang terlalu jauh: garis TIDAK ditarik dari titik sebelumnya. */
  gap?: boolean;
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
