import { ActivityType } from '@prisma/client';

/**
 * Aturan harga & batas waktu Bomb Mission. Server adalah sumber kebenaran: koin, taruhan RP, dan pace maksimum
 * SELALU dihitung ulang di sini, bukan dipercaya dari client.
 * Salinan frontend: frontend/src/lib/questPricing.ts (tabel dan rumus harus tetap sama).
 */

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'HELL';
export type StakesTier = 'LOW' | 'MEDIUM' | 'HIGH';

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'HELL'];

/** Jarak yang boleh dipilih (km). Dibatasi agar tidak ada target mustahil atau terlalu murah. */
export const DISTANCE_OPTIONS_KM: Record<ActivityType, number[]> = {
  [ActivityType.RUNNING]: [1, 2, 3, 5, 7, 10],
  [ActivityType.CYCLING]: [5, 10, 15, 20, 30],
};

/** Opsi tenggat (hari). */
export const DEADLINE_OPTIONS_DAYS = [1, 2, 3, 5, 7];
export const MIN_DEADLINE_DAYS = 1;
export const MAX_DEADLINE_DAYS = 7;

/**
 * Pace maksimum (menit/km) per tingkat kesulitan. Lari: Easy = jalan cepat, Hell = 6:00/km (5 km dalam 30 menit),
 * masih realistis untuk pelari rekreasi. Sepeda dihitung dari kecepatan rata-rata (km/jam).
 */
const RUN_PACE_MIN_PER_KM: Record<Difficulty, number> = { EASY: 11, MEDIUM: 8.5, HARD: 7, HELL: 6 };
const BIKE_SPEED_KMH: Record<Difficulty, number> = { EASY: 12, MEDIUM: 16, HARD: 20, HELL: 24 };

/** Jarak jauh melelahkan: pace yang diizinkan sedikit lebih longgar (5%). */
const LONG_RUN_KM = 7;
const LONG_RIDE_KM = 20;
const FATIGUE_FACTOR = 1.05;

/** Harga dasar koin per km dan pengali. */
const COINS_PER_KM: Record<ActivityType, number> = {
  [ActivityType.RUNNING]: 2.5,
  [ActivityType.CYCLING]: 0.8,
};
const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { EASY: 1, MEDIUM: 1.4, HARD: 1.9, HELL: 2.5 };
/** Makin singkat tenggat, makin mahal. Indeks = jumlah hari (1–7). */
const DEADLINE_MULTIPLIER = [0, 1.6, 1.35, 1.2, 1.1, 1.1, 1.0, 1.0];

export const MIN_COINS = 5;
export const MAX_COINS = 100;

/** Batas atas koin per tingkat taruhan, dan RP yang dipertaruhkan. */
const STAKES_TIERS: { tier: StakesTier; maxCoins: number; points: number }[] = [
  { tier: 'LOW', maxCoins: 20, points: 30 },
  { tier: 'MEDIUM', maxCoins: 50, points: 70 },
  { tier: 'HIGH', maxCoins: Infinity, points: 120 },
];

export interface QuestPrice {
  /** Pace maksimum (menit/km) = batas waktu / jarak. */
  maxPace: number;
  /** Batas waktu total (menit). */
  timeLimitMin: number;
  coins: number;
  stakesTier: StakesTier;
  stakesPoints: number;
}

export function isAllowedDistance(type: ActivityType, distanceKm: number): boolean {
  return DISTANCE_OPTIONS_KM[type].some((d) => Math.abs(d - distanceKm) < 0.001);
}

/** Pace maksimum (menit/km) untuk jenis, jarak, dan kesulitan tertentu. */
export function maxPaceFor(type: ActivityType, distanceKm: number, difficulty: Difficulty): number {
  const base =
    type === ActivityType.RUNNING ? RUN_PACE_MIN_PER_KM[difficulty] : 60 / BIKE_SPEED_KMH[difficulty];
  const long = type === ActivityType.RUNNING ? distanceKm >= LONG_RUN_KM : distanceKm >= LONG_RIDE_KM;
  return base * (long ? FATIGUE_FACTOR : 1);
}

export function stakesFor(coins: number): { tier: StakesTier; points: number } {
  const t = STAKES_TIERS.find((s) => coins <= s.maxCoins) ?? STAKES_TIERS[STAKES_TIERS.length - 1];
  return { tier: t.tier, points: t.points };
}

/** Hitung harga lengkap. `deadlineDays` dibulatkan ke 1–7 hari. */
export function priceQuest(input: {
  type: ActivityType;
  distanceKm: number;
  difficulty: Difficulty;
  deadlineDays: number;
}): QuestPrice {
  const days = Math.min(MAX_DEADLINE_DAYS, Math.max(MIN_DEADLINE_DAYS, Math.round(input.deadlineDays)));
  const pace = maxPaceFor(input.type, input.distanceKm, input.difficulty);
  const raw =
    input.distanceKm *
    COINS_PER_KM[input.type] *
    DIFFICULTY_MULTIPLIER[input.difficulty] *
    DEADLINE_MULTIPLIER[days];
  const coins = Math.min(MAX_COINS, Math.max(MIN_COINS, Math.round(raw)));
  const stakes = stakesFor(coins);
  return {
    maxPace: Number(pace.toFixed(2)),
    timeLimitMin: Math.round(input.distanceKm * pace),
    coins,
    stakesTier: stakes.tier,
    stakesPoints: stakes.points,
  };
}
