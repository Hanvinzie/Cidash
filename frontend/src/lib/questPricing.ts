import type { ActivityType } from '../types';

/**
 * Aturan harga & batas waktu Bomb Mission. Ini hanya PRATINJAU untuk UI; server menghitung ulang semuanya
 * dan mengabaikan nilai dari client. Salinan backend: backend/src/quests/quest-pricing.ts
 * (tabel dan rumus harus tetap sama).
 */

export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD' | 'HELL';
export type StakesTier = 'LOW' | 'MEDIUM' | 'HIGH';

export const DIFFICULTIES: Difficulty[] = ['EASY', 'MEDIUM', 'HARD', 'HELL'];

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: 'Easy', MEDIUM: 'Medium', HARD: 'Hard', HELL: 'Hell' };
export const STAKES_LABEL: Record<StakesTier, string> = { LOW: 'Low', MEDIUM: 'Medium', HIGH: 'High' };

/** Jarak yang boleh dipilih (km). */
export const DISTANCE_OPTIONS_KM: Record<ActivityType, number[]> = {
  run: [1, 2, 3, 5, 7, 10],
  bike: [5, 10, 15, 20, 30],
};

/** Opsi tenggat (hari), 1–7. */
export const DEADLINE_OPTIONS_DAYS = [1, 2, 3, 5, 7];
const MIN_DEADLINE_DAYS = 1;
const MAX_DEADLINE_DAYS = 7;

const RUN_PACE_MIN_PER_KM: Record<Difficulty, number> = { EASY: 11, MEDIUM: 8.5, HARD: 7, HELL: 6 };
const BIKE_SPEED_KMH: Record<Difficulty, number> = { EASY: 12, MEDIUM: 16, HARD: 20, HELL: 24 };
const LONG_RUN_KM = 7;
const LONG_RIDE_KM = 20;
const FATIGUE_FACTOR = 1.05;

const COINS_PER_KM: Record<ActivityType, number> = { run: 2.5, bike: 0.8 };
const DIFFICULTY_MULTIPLIER: Record<Difficulty, number> = { EASY: 1, MEDIUM: 1.4, HARD: 1.9, HELL: 2.5 };
/** Indeks = jumlah hari (1–7). Makin singkat makin mahal. */
const DEADLINE_MULTIPLIER = [0, 1.6, 1.35, 1.2, 1.1, 1.1, 1.0, 1.0];

const MIN_COINS = 5;
const MAX_COINS = 100;

const STAKES_TIERS: { tier: StakesTier; maxCoins: number; points: number }[] = [
  { tier: 'LOW', maxCoins: 20, points: 30 },
  { tier: 'MEDIUM', maxCoins: 50, points: 70 },
  { tier: 'HIGH', maxCoins: Infinity, points: 120 },
];

export interface QuestPrice {
  /** Pace maksimum (menit/km). */
  maxPace: number;
  /** Batas waktu total (menit). */
  timeLimitMin: number;
  coins: number;
  stakesTier: StakesTier;
  stakesPoints: number;
}

export function maxPaceFor(type: ActivityType, distanceKm: number, difficulty: Difficulty): number {
  const base = type === 'run' ? RUN_PACE_MIN_PER_KM[difficulty] : 60 / BIKE_SPEED_KMH[difficulty];
  const long = type === 'run' ? distanceKm >= LONG_RUN_KM : distanceKm >= LONG_RIDE_KM;
  return base * (long ? FATIGUE_FACTOR : 1);
}

export function priceQuest(input: {
  type: ActivityType;
  distanceKm: number;
  difficulty: Difficulty;
  deadlineDays: number;
}): QuestPrice {
  const days = Math.min(MAX_DEADLINE_DAYS, Math.max(MIN_DEADLINE_DAYS, Math.round(input.deadlineDays)));
  const pace = maxPaceFor(input.type, input.distanceKm, input.difficulty);
  const raw =
    input.distanceKm * COINS_PER_KM[input.type] * DIFFICULTY_MULTIPLIER[input.difficulty] * DEADLINE_MULTIPLIER[days];
  const coins = Math.min(MAX_COINS, Math.max(MIN_COINS, Math.round(raw)));
  const stakes = STAKES_TIERS.find((s) => coins <= s.maxCoins) ?? STAKES_TIERS[STAKES_TIERS.length - 1];
  return {
    maxPace: Number(pace.toFixed(2)),
    timeLimitMin: Math.round(input.distanceKm * pace),
    coins,
    stakesTier: stakes.tier,
    stakesPoints: stakes.points,
  };
}

/** 55 → "55 min", 81 → "1 h 21 min". */
export function formatMinutes(min: number): string {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
