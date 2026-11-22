import { estimateCalories } from './geo';
import { readWeightKg } from './settings';
import type { ActivityType } from '../types';

/** Kalori aktivitas memakai berat badan yang diisi pengguna (atau bawaan). Satu pintu agar semua layar konsisten. */
export function caloriesFor(distanceKm: number, type: ActivityType, durationSec: number): number {
  return estimateCalories(distanceKm, type, durationSec, readWeightKg());
}
