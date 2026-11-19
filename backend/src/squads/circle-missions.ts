import { ActivityType } from '@prisma/client';
import * as crypto from 'crypto';

export type MissionCadence = 'daily' | 'weekly';

export interface CircleMissionTemplate {
  code: string;
  /** Gunakan placeholder {km} untuk menyisipkan target jarak dinamis. */
  titleTemplate: string;
  activityType: ActivityType;
  kmPerMember: number;
  minKm: number;
  maxKm: number;
  rewardRankPoints: number;
  rewardCoins: number;
}

export interface MissionPeriodWindow {
  periodKey: string;
  prevPeriodKey: string;
  start: Date;
  end: Date;
  deadlineLabel: string;
}

export interface GeneratedCircleMissionSpec {
  id: string;
  circleId: string;
  cadence: MissionCadence;
  periodKey: string;
  code: string;
  title: string;
  activityType: ActivityType;
  targetKm: number;
  rewardRankPoints: number;
  rewardCoins: number;
  start: Date;
  end: Date;
  deadline: string;
  deadlineIso: string;
  claimReference: string;
}

// Zona waktu WIB (UTC+7) untuk konsistensi reset harian & mingguan
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export const DAILY_MISSION_POOL: readonly CircleMissionTemplate[] = [
  {
    code: 'DAILY_MORNING_STRIDE',
    titleTemplate: 'Morning {km}K Circle Run',
    activityType: ActivityType.RUNNING,
    kmPerMember: 2,
    minKm: 3,
    maxKm: 20,
    rewardRankPoints: 15,
    rewardCoins: 5,
  },
  {
    code: 'DAILY_SUNSET_PACE',
    titleTemplate: 'Sunset {km}K Tempo',
    activityType: ActivityType.RUNNING,
    kmPerMember: 2.5,
    minKm: 4,
    maxKm: 25,
    rewardRankPoints: 20,
    rewardCoins: 5,
  },
  {
    code: 'DAILY_EASY_SPIN',
    titleTemplate: 'Easy {km}K Circle Ride',
    activityType: ActivityType.CYCLING,
    kmPerMember: 5,
    minKm: 8,
    maxKm: 60,
    rewardRankPoints: 15,
    rewardCoins: 5,
  },
  {
    code: 'DAILY_CITY_CRUISE',
    titleTemplate: 'City Cruise {km}K Bike',
    activityType: ActivityType.CYCLING,
    kmPerMember: 6,
    minKm: 10,
    maxKm: 75,
    rewardRankPoints: 20,
    rewardCoins: 5,
  },
  {
    code: 'DAILY_RECOVERY_JOG',
    titleTemplate: 'Recovery {km}K Jog',
    activityType: ActivityType.RUNNING,
    kmPerMember: 1.5,
    minKm: 2,
    maxKm: 15,
    rewardRankPoints: 15,
    rewardCoins: 5,
  },
  {
    code: 'DAILY_CADENCE_DASH',
    titleTemplate: 'Cadence {km}K Dash',
    activityType: ActivityType.RUNNING,
    kmPerMember: 3,
    minKm: 5,
    maxKm: 30,
    rewardRankPoints: 20,
    rewardCoins: 8,
  },
  {
    code: 'DAILY_PELOTON_SPRINT',
    titleTemplate: 'Peloton {km}K Sprint',
    activityType: ActivityType.CYCLING,
    kmPerMember: 7,
    minKm: 12,
    maxKm: 80,
    rewardRankPoints: 20,
    rewardCoins: 8,
  },
  {
    code: 'DAILY_TWILIGHT_MILES',
    titleTemplate: 'Twilight {km}K Run',
    activityType: ActivityType.RUNNING,
    kmPerMember: 2,
    minKm: 3,
    maxKm: 20,
    rewardRankPoints: 15,
    rewardCoins: 5,
  },
];

export const WEEKLY_MISSION_POOL: readonly CircleMissionTemplate[] = [
  {
    code: 'WEEKLY_CIRCLE_MILEAGE',
    titleTemplate: 'Circle Mileage {km}K',
    activityType: ActivityType.RUNNING,
    kmPerMember: 10,
    minKm: 15,
    maxKm: 150,
    rewardRankPoints: 45,
    rewardCoins: 15,
  },
  {
    code: 'WEEKLY_ENDURANCE_RUN',
    titleTemplate: 'Endurance {km}K Run',
    activityType: ActivityType.RUNNING,
    kmPerMember: 12,
    minKm: 20,
    maxKm: 180,
    rewardRankPoints: 50,
    rewardCoins: 20,
  },
  {
    code: 'WEEKLY_GRAND_TOUR',
    titleTemplate: 'Grand Tour {km}K Ride',
    activityType: ActivityType.CYCLING,
    kmPerMember: 25,
    minKm: 35,
    maxKm: 350,
    rewardRankPoints: 45,
    rewardCoins: 15,
  },
  {
    code: 'WEEKLY_PELOTON_TOUR',
    titleTemplate: 'Peloton {km}K Challenge',
    activityType: ActivityType.CYCLING,
    kmPerMember: 30,
    minKm: 40,
    maxKm: 400,
    rewardRankPoints: 55,
    rewardCoins: 20,
  },
  {
    code: 'WEEKLY_MARATHON_RELAY',
    titleTemplate: 'Relay {km}K Marathon',
    activityType: ActivityType.RUNNING,
    kmPerMember: 14,
    minKm: 20,
    maxKm: 200,
    rewardRankPoints: 55,
    rewardCoins: 20,
  },
  {
    code: 'WEEKLY_SPEED_RUNNERS',
    titleTemplate: 'Squad {km}K Stride',
    activityType: ActivityType.RUNNING,
    kmPerMember: 8,
    minKm: 12,
    maxKm: 120,
    rewardRankPoints: 40,
    rewardCoins: 15,
  },
  {
    code: 'WEEKLY_WEEKEND_WHEELS',
    titleTemplate: 'Weekend Wheels {km}K',
    activityType: ActivityType.CYCLING,
    kmPerMember: 20,
    minKm: 30,
    maxKm: 300,
    rewardRankPoints: 40,
    rewardCoins: 15,
  },
  {
    code: 'WEEKLY_TRAIL_GRIND',
    titleTemplate: 'Squad Grind {km}K Run',
    activityType: ActivityType.RUNNING,
    kmPerMember: 11,
    minKm: 15,
    maxKm: 160,
    rewardRankPoints: 50,
    rewardCoins: 18,
  },
];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function formatWibDateKey(wibDate: Date): string {
  return `${wibDate.getUTCFullYear()}-${pad2(wibDate.getUTCMonth() + 1)}-${pad2(wibDate.getUTCDate())}`;
}

function getIsoWeekKey(wibDate: Date): string {
  const d = new Date(
    Date.UTC(
      wibDate.getUTCFullYear(),
      wibDate.getUTCMonth(),
      wibDate.getUTCDate(),
    ),
  );
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7,
  );
  return `${d.getUTCFullYear()}-W${pad2(weekNo)}`;
}

export function getMissionPeriodWindow(
  cadence: MissionCadence,
  now: Date = new Date(),
): MissionPeriodWindow {
  const wibNow = new Date(now.getTime() + WIB_OFFSET_MS);

  if (cadence === 'daily') {
    const startWibMs = Date.UTC(
      wibNow.getUTCFullYear(),
      wibNow.getUTCMonth(),
      wibNow.getUTCDate(),
      0,
      0,
      0,
      0,
    );
    const endWibMs = startWibMs + DAY_MS - 1;
    const prevWibDate = new Date(startWibMs - DAY_MS);

    return {
      periodKey: formatWibDateKey(wibNow),
      prevPeriodKey: formatWibDateKey(prevWibDate),
      start: new Date(startWibMs - WIB_OFFSET_MS),
      end: new Date(endWibMs - WIB_OFFSET_MS),
      deadlineLabel: 'Today, 23:59',
    };
  }

  // Weekly: Senin 00:00 WIB -> Minggu 23:59:59.999 WIB
  const dayOfWeek = wibNow.getUTCDay(); // 0=Sun, 1=Mon, ...
  const daysSinceMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const mondayWibMs =
    Date.UTC(
      wibNow.getUTCFullYear(),
      wibNow.getUTCMonth(),
      wibNow.getUTCDate(),
      0,
      0,
      0,
      0,
    ) -
    daysSinceMonday * DAY_MS;
  const sundayEndWibMs = mondayWibMs + 7 * DAY_MS - 1;
  const prevMondayWibDate = new Date(mondayWibMs - 7 * DAY_MS);

  return {
    periodKey: getIsoWeekKey(wibNow),
    prevPeriodKey: getIsoWeekKey(prevMondayWibDate),
    start: new Date(mondayWibMs - WIB_OFFSET_MS),
    end: new Date(sundayEndWibMs - WIB_OFFSET_MS),
    deadlineLabel: 'Sun, 23:59',
  };
}

function hashToIndex(seed: string, length: number): number {
  const digest = crypto.createHash('sha256').update(seed).digest();
  return digest.readUInt32BE(0) % length;
}

function selectTemplate(
  squadId: string,
  cadence: MissionCadence,
  periodKey: string,
  prevPeriodKey: string,
  pool: readonly CircleMissionTemplate[],
): CircleMissionTemplate {
  let idx = hashToIndex(`${squadId}:${cadence}:${periodKey}`, pool.length);
  const prevIdx = hashToIndex(
    `${squadId}:${cadence}:${prevPeriodKey}`,
    pool.length,
  );
  // Hindari template yang persis sama dua periode berturut-turut
  if (pool.length > 1 && idx === prevIdx) {
    idx = (idx + 1) % pool.length;
  }
  return pool[idx];
}

function computeScaledTargetKm(
  template: CircleMissionTemplate,
  memberCount: number,
  cadence: MissionCadence,
): number {
  const safeMembers = Math.max(1, memberCount);
  const raw = template.kmPerMember * safeMembers;
  const clamped = Math.min(template.maxKm, Math.max(template.minKm, raw));
  if (cadence === 'weekly' && clamped >= 20) {
    return Math.round(clamped / 5) * 5;
  }
  return Math.round(clamped);
}

export function buildCircleMissionSpec(
  squadId: string,
  cadence: MissionCadence,
  memberCount: number,
  activityType: ActivityType = ActivityType.RUNNING,
  now: Date = new Date(),
): GeneratedCircleMissionSpec {
  const fullPool = cadence === 'daily' ? DAILY_MISSION_POOL : WEEKLY_MISSION_POOL;
  const typedPool = fullPool.filter((t) => t.activityType === activityType);
  const pool = typedPool.length > 0 ? typedPool : fullPool;
  const window = getMissionPeriodWindow(cadence, now);
  const template = selectTemplate(
    squadId,
    cadence,
    window.periodKey,
    window.prevPeriodKey,
    pool,
  );
  const targetKm = computeScaledTargetKm(template, memberCount, cadence);
  const title = template.titleTemplate.replace('{km}', String(targetKm));

  return {
    id: `cm_${cadence}_${window.periodKey}_${squadId.slice(0, 8)}`,
    circleId: squadId,
    cadence,
    periodKey: window.periodKey,
    code: template.code,
    title,
    activityType: template.activityType,
    targetKm,
    rewardRankPoints: template.rewardRankPoints,
    rewardCoins: template.rewardCoins,
    start: window.start,
    end: window.end,
    deadline: window.deadlineLabel,
    deadlineIso: window.end.toISOString(),
    claimReference: `CIRCLE-${cadence.toUpperCase()}:${window.periodKey}:${squadId}`,
  };
}
