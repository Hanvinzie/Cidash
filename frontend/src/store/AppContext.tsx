import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  circleMembers,
  initialActivityHistory,
  initialBombMissions,
  initialCircles,
  initialGroupMissions,
  initialUser,
  leaderboardByCircle,
} from '../data/mock';
import type {
  ActivityLog,
  ActivityType,
  BombMission,
  Circle,
  GeoPoint,
  GroupMission,
  LeaderboardEntry,
  RunMode,
  User,
  VerificationResult,
} from '../types';

// ============================================================
// State global prototype. Setiap aksi bertanda TODO adalah titik
// integrasi REST API backend — ganti isi fungsinya, bukan signature-nya.
// ============================================================

const AUTH_KEY = 'cidash_auth';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa karakter ambigu (0/O, 1/I)

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}`;
const generateCircleCode = () =>
  Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export interface SendBombInput {
  targetUserId: string;
  type: ActivityType;
  targetKm: number;
  durationMin: number;
  deadline: string;
  wagerCoins: number;
}

export interface RecordActivityInput {
  missionId: string | null; // null = latihan bebas
  mode: RunMode;
  type: ActivityType;
  distanceKm: number;
  durationSec: number;
  route: GeoPoint[];
  speedViolation: boolean;
}

interface AppState {
  isAuthenticated: boolean;
  user: User;
  circles: Circle[];
  activeCircle: Circle | null;
  members: Pick<User, 'id' | 'username'>[];
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  groupMissions: GroupMission[];
  bombMissions: BombMission[];
  activityHistory: ActivityLog[];

  login: () => void;
  logout: () => void;
  setActiveCircle: (id: string) => void;
  createCircle: (name: string) => Circle;
  joinCircle: (code: string) => Circle;
  topUp: (coins: number) => void;
  sendBomb: (input: SendBombInput) => void;
  acceptBomb: (id: string) => void;
  rejectBomb: (id: string) => void;
  recordActivity: (input: RecordActivityInput) => VerificationResult;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuth] = useState(() => localStorage.getItem(AUTH_KEY) === '1');
  const [user, setUser] = useState(initialUser);
  const [seasonDistanceKm, setSeasonDistanceKm] = useState(61.1);
  const [circles, setCircles] = useState(initialCircles);
  const [activeCircleId, setActiveCircleId] = useState(initialCircles[0]?.id ?? null);
  const [groupMissions, setGroupMissions] = useState(initialGroupMissions);
  const [bombMissions, setBombMissions] = useState(initialBombMissions);
  const [activityHistory, setActivityHistory] = useState(initialActivityHistory);

  const activeCircle = circles.find((c) => c.id === activeCircleId) ?? null;

  // Leaderboard circle aktif + user saat ini, diurutkan Rank Points.
  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (!activeCircle) return [];
    const others = leaderboardByCircle[activeCircle.id] ?? [];
    return [
      ...others,
      { user: { id: user.id, username: user.username }, rankPoints: user.rankPoints, totalDistanceKm: +seasonDistanceKm.toFixed(1) },
    ]
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [activeCircle, user, seasonDistanceKm]);

  const myRank = leaderboard.find((e) => e.user.id === user.id)?.rank ?? null;

  // TODO: POST /auth/login | /auth/register — simpan JWT, bukan flag.
  const login = useCallback(() => {
    localStorage.setItem(AUTH_KEY, '1');
    setAuth(true);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(AUTH_KEY);
    setAuth(false);
  }, []);

  // TODO: POST /circles
  const createCircle = useCallback((name: string) => {
    const circle: Circle = { id: newId('cir'), name, code: generateCircleCode(), memberCount: 1 };
    setCircles((cs) => [...cs, circle]);
    setActiveCircleId(circle.id);
    return circle;
  }, []);

  // TODO: POST /circles/join — backend memvalidasi kode & mengembalikan circle.
  const joinCircle = useCallback(
    (code: string) => {
      const existing = circles.find((c) => c.code === code);
      const circle = existing ?? { id: newId('cir'), name: `Circle ${code}`, code, memberCount: 2 };
      if (!existing) setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      return circle;
    },
    [circles],
  );

  // TODO: alur Payment Gateway (Midtrans/Xendit) — koin ditambah via webhook backend.
  const topUp = useCallback((coins: number) => {
    setUser((u) => ({ ...u, coins: u.coins + coins }));
  }, []);

  // TODO: POST /quests/bomb — backend memotong koin (escrow).
  const sendBomb = useCallback(
    (input: SendBombInput) => {
      const target = Object.values(circleMembers).flat().find((m) => m.id === input.targetUserId);
      if (!target || input.wagerCoins > user.coins) return;
      setUser((u) => ({ ...u, coins: u.coins - input.wagerCoins }));
      setBombMissions((bs) => [
        {
          id: newId('bm'),
          direction: 'sent',
          counterpart: target,
          type: input.type,
          targetKm: input.targetKm,
          durationMin: input.durationMin,
          deadline: new Date(input.deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
          wagerCoins: input.wagerCoins,
          rewardRankPoints: input.wagerCoins * 2,
          penaltyRankPoints: input.wagerCoins,
          status: 'pending',
        },
        ...bs,
      ]);
    },
    [user.coins],
  );

  // TODO: PATCH /quests/bomb/:id { action: 'accept' | 'reject' }
  const acceptBomb = useCallback((id: string) => {
    setBombMissions((bs) => bs.map((b) => (b.id === id ? { ...b, status: 'in_progress' } : b)));
  }, []);

  const rejectBomb = useCallback((id: string) => {
    setBombMissions((bs) => bs.filter((b) => b.id !== id));
  }, []);

  // TODO: POST /activities — backend memverifikasi ulang rute (Haversine + anti-cheat).
  const recordActivity = useCallback(
    (input: RecordActivityInput): VerificationResult => {
      const base = { distanceKm: input.distanceKm, durationSec: input.durationSec };

      if (input.speedViolation) {
        return { ...base, valid: false, reason: 'Unrealistic speed detected (looks like a motor vehicle).', rankPointsDelta: 0 };
      }
      if (input.distanceKm < 0.05) {
        return { ...base, valid: false, reason: 'Distance too short to verify (min. 50 m).', rankPointsDelta: 0 };
      }

      let rankPointsDelta = Math.round(input.distanceKm * 10);
      let missionStatus: VerificationResult['missionStatus'];

      const bomb = bombMissions.find((b) => b.id === input.missionId);
      const group = groupMissions.find((g) => g.id === input.missionId);

      if (bomb) {
        const success = input.distanceKm >= bomb.targetKm && input.durationSec <= bomb.durationMin * 60;
        missionStatus = success ? 'completed' : 'failed';
        rankPointsDelta = success ? bomb.rewardRankPoints : -bomb.penaltyRankPoints;
        if (success) setUser((u) => ({ ...u, coins: u.coins + bomb.wagerCoins }));
        setBombMissions((bs) => bs.map((b) => (b.id === bomb.id ? { ...b, status: missionStatus! } : b)));
      } else if (group) {
        const progressKm = +(group.progressKm + input.distanceKm).toFixed(2);
        missionStatus = progressKm >= group.targetKm ? 'completed' : 'in_progress';
        if (missionStatus === 'completed') rankPointsDelta += 20;
        setGroupMissions((gs) => gs.map((g) => (g.id === group.id ? { ...g, progressKm, status: missionStatus! } : g)));
      }

      setUser((u) => ({ ...u, rankPoints: Math.max(0, u.rankPoints + rankPointsDelta) }));
      setSeasonDistanceKm((d) => d + input.distanceKm);
      const log: ActivityLog = {
        id: newId('act'),
        type: input.type,
        mode: input.mode,
        distanceKm: +input.distanceKm.toFixed(2),
        durationSec: input.durationSec,
        date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
        routeLabel: bomb
          ? `Bomb from ${bomb.counterpart.username}`
          : group?.title ?? (input.mode === 'group' ? 'Group Run' : 'Free workout'),
        missionStatus: missionStatus ?? 'completed',
        route: input.route,
        circle: activeCircle ? { name: activeCircle.name, code: activeCircle.code } : null,
      };
      setActivityHistory((h) => [log, ...h]);

      return { ...base, valid: true, rankPointsDelta, missionStatus, log };
    },
    [bombMissions, groupMissions, activeCircle],
  );

  const value: AppState = {
    isAuthenticated,
    user,
    circles,
    activeCircle,
    members: activeCircle ? circleMembers[activeCircle.id] ?? [] : [],
    leaderboard,
    myRank,
    groupMissions: groupMissions.filter((g) => g.circleId === activeCircleId),
    bombMissions,
    activityHistory,
    login,
    logout,
    setActiveCircle: setActiveCircleId,
    createCircle,
    joinCircle,
    topUp,
    sendBomb,
    acceptBomb,
    rejectBomb,
    recordActivity,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
