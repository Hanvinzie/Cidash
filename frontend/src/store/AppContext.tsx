import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
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
import { del, http, post, tokenStore } from '../services/http';
import { decodeSegments, encodePolyline, encodeRoute } from '../lib/polyline';
import { useToast } from './ToastContext';
import type {
  ActivityLog,
  ActivityType,
  AvailabilityStatus,
  BombMission,
  Circle,
  CircleMember,
  GeoPoint,
  GroupMission,
  LeaderboardEntry,
  RunMode,
  User,
  VerificationResult,
} from '../types';

const AUTH_KEY = 'cidash_auth';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_SHIELD_TICKETS = 2;
const SHIELD_WEEKLY_COSTS = [25, 50] as const;
const REST_WEEKLY_COSTS = [0, 15] as const;
const SNOOZE_COST_COINS = 10;

const newId = (prefix: string) => `${prefix}_${Date.now().toString(36)}`;
const generateCircleCode = () =>
  Array.from({ length: 8 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');

export interface AuthCredentials {
  mode?: 'login' | 'register';
  name?: string;
  email?: string;
  password?: string;
}

export interface SendBombInput {
  targetUserId: string;
  type: ActivityType;
  targetKm: number;
  durationMin: number;
  deadline: string;
  wagerCoins: number;
}

export interface RecordActivityInput {
  missionId: string | null;
  mode: RunMode;
  type: ActivityType;
  distanceKm: number;
  durationSec: number;
  route: GeoPoint[];
  speedViolation: boolean;
  /** Id sesi rekam (UUID) — server menyelesaikan draft hasil batch sync, bukan membuat baris baru. */
  sessionId?: string | null;
  /** Waktu mulai rekam (ms). Default: sekarang dikurangi durasi. */
  startedAt?: number | null;
  elevationGain?: number;
  /** Label hasil reverse geocoding (dijalankan sekali saat Finish). */
  locationLabel?: string | null;
}

interface BackendUser {
  id: string;
  email: string;
  name: string;
  coinBalance: number;
  rankPoints: number;
  shieldTickets: number;
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

export type TargetMemberInfo = Pick<User, 'id' | 'username'> & {
  availabilityStatus?: AvailabilityStatus;
  restUntil?: string | null;
};

interface AppState {
  isAuthenticated: boolean;
  hydrating: boolean;
  user: User;
  circles: Circle[];
  activeCircle: Circle | null;
  members: TargetMemberInfo[];
  /** Semua anggota circle (termasuk user) — captain dulu, lalu urut Rank Points. */
  membersOf: (circleId: string) => CircleMember[];
  leaderboard: LeaderboardEntry[];
  myRank: number | null;
  groupMissions: GroupMission[];
  bombMissions: BombMission[];
  activityHistory: ActivityLog[];

  login: (credentials?: AuthCredentials) => Promise<{ circleCount: number }>;
  logout: () => void;
  updateProfileName: (name: string) => void;
  setActiveCircle: (id: string) => void;
  createCircle: (name: string) => Promise<Circle>;
  joinCircle: (code: string) => Promise<Circle>;
  upgradeCircle: (circleId: string) => Promise<void>;
  leaveCircle: (circleId: string) => Promise<void>;
  kickMember: (circleId: string, targetUserId: string) => Promise<void>;
  topUp: (coins: number) => void;
  buyShield: () => Promise<void>;
  setAvailabilityStatus: (status: 'AVAILABLE' | 'RESTING') => Promise<void>;
  sendBomb: (input: SendBombInput) => void;
  acceptBomb: (id: string) => void;
  rejectBomb: (id: string) => void;
  useShield: (id: string) => void;
  snoozeBomb: (id: string) => void;
  recordActivity: (input: RecordActivityInput) => VerificationResult;
}

const AppContext = createContext<AppState | null>(null);

/** Decode rute encoded polyline dari server. Timestamp sintetis (hanya urutan yang dipakai untuk render). */
function parsePolylineRoute(encoded: string | null | undefined): GeoPoint[] {
  if (!encoded) return [];
  try {
    const now = Date.now();
    let idx = 0;
    // Segmen ke-2 dan seterusnya diawali titik `gap` agar tidak digambar tersambung.
    return decodeSegments(encoded).flatMap((segment, si) =>
      segment.map(([lat, lng], pi) => ({ lat, lng, timestamp: now + idx++ * 1000, ...(si > 0 && pi === 0 ? { gap: true } : {}) })),
    );
  } catch {
    return [];
  }
}

/** Build a valid multi-point coordinate path matching distanceMeters when few GPS points exist. */
function buildConsistentCoordinates(route: GeoPoint[], distanceMeters: number): [number, number][] {
  if (route.length >= 2) {
    return route.map((p) => [p.lng, p.lat]);
  }
  const startLat = route[0]?.lat ?? -6.2183;
  const startLng = route[0]?.lng ?? 106.8022;
  const steps = Math.max(2, Math.min(50, Math.ceil(distanceMeters / 250) + 1));
  const stepMeters = distanceMeters / (steps - 1);
  const stepDegLat = stepMeters / 111_320;
  return Array.from({ length: steps }, (_, i) => [
    +(startLng + i * stepDegLat * 0.15).toFixed(6),
    +(startLat + i * stepDegLat).toFixed(6),
  ]);
}

export function AppProvider({ children }: { children: ReactNode }) {
  const toast = useToast();
  const hasToken = Boolean(tokenStore.get());
  const [isAuthenticated, setAuth] = useState(
    () => localStorage.getItem(AUTH_KEY) === '1' || Boolean(tokenStore.get()),
  );
  const [hydrating, setHydrating] = useState(hasToken);
  const [user, setUser] = useState<User>({
    ...initialUser,
    shieldTickets: 1,
    availabilityStatus: 'AVAILABLE',
    restUntil: null,
    weeklyShieldsBought: 0,
    maxWeeklyShields: 2,
    maxShieldTickets: MAX_SHIELD_TICKETS,
    nextShieldCost: SHIELD_WEEKLY_COSTS[0],
    weeklyRestUsed: 0,
    maxWeeklyRest: 2,
    nextRestCost: REST_WEEKLY_COSTS[0],
  });
  const [seasonDistanceKm, setSeasonDistanceKm] = useState(hasToken ? 0 : 61.1);
  const [circles, setCircles] = useState<Circle[]>(hasToken ? [] : initialCircles);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(
    hasToken ? null : (initialCircles[0]?.id ?? null),
  );
  const [backendLeaderboard, setBackendLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [backendMembers, setBackendMembers] = useState<TargetMemberInfo[] | null>(null);
  /** Captain circle aktif menurut backend (role CAPTAIN di leaderboard). */
  const [backendCaptainId, setBackendCaptainId] = useState<string | null>(null);
  const [groupMissions, setGroupMissions] = useState<GroupMission[]>(hasToken ? [] : initialGroupMissions);
  const [bombMissions, setBombMissions] = useState<BombMission[]>(hasToken ? [] : initialBombMissions);
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>(hasToken ? [] : initialActivityHistory);

  const activeCircle = circles.find((c) => c.id === activeCircleId) ?? circles[0] ?? null;

  const mapBackendUser = useCallback(
    (u: BackendUser): User => ({
      id: u.id,
      username: u.name,
      email: u.email,
      rankPoints: u.rankPoints,
      coins: u.coinBalance,
      shieldTickets: u.shieldTickets ?? 0,
      availabilityStatus: u.availabilityStatus ?? 'AVAILABLE',
      restUntil: u.restUntil ?? null,
      weeklyShieldsBought: u.weeklyShieldsBought ?? 0,
      maxWeeklyShields: u.maxWeeklyShields ?? 2,
      maxShieldTickets: u.maxShieldTickets ?? MAX_SHIELD_TICKETS,
      nextShieldCost:
        u.nextShieldCost !== undefined
          ? u.nextShieldCost
          : (u.shieldTickets ?? 0) >= MAX_SHIELD_TICKETS
            ? null
            : SHIELD_WEEKLY_COSTS[u.weeklyShieldsBought ?? 0] ?? null,
      weeklyRestUsed: u.weeklyRestUsed ?? 0,
      maxWeeklyRest: u.maxWeeklyRest ?? 2,
      nextRestCost:
        u.nextRestCost !== undefined
          ? u.nextRestCost
          : REST_WEEKLY_COSTS[u.weeklyRestUsed ?? 0] ?? null,
    }),
    [],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(AUTH_KEY);
    setBackendLeaderboard(null);
    setBackendMembers(null);
    setBackendCaptainId(null);
    setAuth(false);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      logout();
      toast('Session expired. Please sign in again.', 'error');
    };
    window.addEventListener('cidash:unauthorized', onUnauthorized);
    return () => window.removeEventListener('cidash:unauthorized', onUnauthorized);
  }, [logout, toast]);

  const syncCircleLeaderboard = useCallback(async (circleId: string, currentUserId: string) => {
    try {
      const res = await http<{
        leaderboard: {
          rank: number;
          userId: string;
          name: string;
          rankPoints: number;
          shieldTickets?: number;
          totalDistanceKm?: number;
          role?: 'CAPTAIN' | 'MEMBER';
          availabilityStatus?: AvailabilityStatus;
          restUntil?: string | null;
        }[];
      }>(`/squads/${circleId}/leaderboard`);

      const entries: LeaderboardEntry[] = res.leaderboard.map((item) => ({
        rank: item.rank,
        user: { id: item.userId, username: item.name },
        rankPoints: item.rankPoints,
        totalDistanceKm: item.totalDistanceKm ?? 0,
        availabilityStatus: item.availabilityStatus ?? 'AVAILABLE',
        restUntil: item.restUntil ?? null,
      }));
      setBackendLeaderboard(entries);
      setBackendCaptainId(res.leaderboard.find((item) => item.role === 'CAPTAIN')?.userId ?? null);
      setBackendMembers(
        res.leaderboard
          .filter((item) => item.userId !== currentUserId)
          .map((item) => ({
            id: item.userId,
            username: item.name,
            availabilityStatus: item.availabilityStatus ?? 'AVAILABLE',
            restUntil: item.restUntil ?? null,
          })),
      );
    } catch {
      setBackendLeaderboard(null);
      setBackendMembers(null);
      setBackendCaptainId(null);
    }
  }, []);

  const syncQuests = useCallback(async (circleId?: string) => {
    try {
      const query = circleId ? `?squadId=${encodeURIComponent(circleId)}` : '';
      const res = await http<{
        quests: {
          id: string;
          rewardTitle: string;
          activityType: 'RUNNING' | 'CYCLING';
          targetDistance: number;
          targetMaxPace?: number | null;
          stakesPoints: number;
          status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'FAILED' | 'SHIELDED';
          deadline: string;
          snoozed?: boolean;
          creator: { id: string; name: string };
          targetUser: { id: string; name: string };
          isTargetUser: boolean;
        }[];
      }>(`/quests/active${query}`);

      const mapped: BombMission[] = res.quests.map((q) => {
        const targetKm = +(q.targetDistance / 1000).toFixed(2);
        const pace = q.targetMaxPace && q.targetMaxPace > 0 ? q.targetMaxPace : 7;
        const durationMin = Math.max(5, Math.round(targetKm * pace));
        return {
          id: q.id,
          direction: q.isTargetUser ? 'incoming' : 'sent',
          counterpart: q.isTargetUser
            ? { id: q.creator.id, username: q.creator.name }
            : { id: q.targetUser.id, username: q.targetUser.name },
          type: q.activityType === 'RUNNING' ? 'run' : 'bike',
          targetKm,
          durationMin,
          deadline: new Date(q.deadline).toLocaleString('en-US', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }),
          wagerCoins: Math.max(5, Math.round(q.stakesPoints / 2)),
          rewardRankPoints: q.stakesPoints,
          penaltyRankPoints: q.stakesPoints,
          snoozed: Boolean(q.snoozed),
          status:
            q.status === 'ACCEPTED'
              ? 'in_progress'
              : q.status === 'COMPLETED'
                ? 'completed'
                : q.status === 'FAILED'
                  ? 'failed'
                  : q.status === 'SHIELDED'
                    ? 'shielded'
                    : 'pending',
        };
      });
      setBombMissions(mapped);
    } catch {
      // Keep local state if offline
    }
  }, []);

  const syncActivities = useCallback(async (currentCircle: Circle | null) => {
    try {
      const res = await http<{
        summary: { totalDistanceKilometers: number };
        activities: {
          id: string;
          type: 'RUNNING' | 'CYCLING';
          distanceKilometers: number;
          durationSeconds: number;
          encodedPolyline?: string | null;
          locationLabel?: string | null;
          elevationGain?: number;
          startedAt: string;
          completedQuest?: { rewardTitle: string } | null;
        }[];
      }>('/activities/history?limit=25');

      setSeasonDistanceKm(res.summary.totalDistanceKilometers);
      const logs: ActivityLog[] = res.activities.map((a) => ({
        id: a.id,
        type: a.type === 'RUNNING' ? 'run' : 'bike',
        mode: 'solo',
        distanceKm: a.distanceKilometers,
        durationSeconds: a.durationSeconds,
        durationSec: a.durationSeconds,
        date: new Date(a.startedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }),
        routeLabel: a.completedQuest?.rewardTitle ?? a.locationLabel ?? 'Recorded workout',
        missionStatus: 'completed',
        route: parsePolylineRoute(a.encodedPolyline),
        locationLabel: a.locationLabel ?? null,
        elevationGain: a.elevationGain ?? 0,
        circle: currentCircle ? { name: currentCircle.name, code: currentCircle.code } : null,
      }));
      setActivityHistory(logs);
    } catch {
      // Keep local state if offline
    }
  }, []);

  const hydrateFromBackend = useCallback(async (): Promise<Circle[]> => {
    const token = tokenStore.get();
    if (!token) {
      setHydrating(false);
      return [];
    }

    setHydrating(true);
    try {
      const [me, mySquadsRes] = await Promise.all([
        http<BackendUser>('/auth/me'),
        http<{
          squads: {
            id: string;
            name: string;
            inviteCode: string;
            isPremium?: boolean;
            totalMembers: number;
            maxMembers?: number;
            captain?: { id: string; name: string } | null;
          }[];
        }>('/squads/my'),
      ]);

      const mappedUser = mapBackendUser(me);
      setUser(mappedUser);

      const mappedCircles: Circle[] = mySquadsRes.squads.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.inviteCode,
        isPremium: Boolean(s.isPremium),
        memberCount: s.totalMembers,
        maxMembers: s.maxMembers ?? (s.isPremium ? 25 : 5),
        captainId: s.captain?.id,
      }));

      setCircles(mappedCircles);
      const selectedCircle =
        mappedCircles.find((c) => c.id === activeCircleId) ?? mappedCircles[0] ?? null;
      setActiveCircleId(selectedCircle?.id ?? null);

      if (mappedCircles.length > 0) {
        setGroupMissions((prev) => {
          const existingIds = new Set(prev.map((g) => g.circleId));
          const extra: GroupMission[] = mappedCircles
            .filter((c) => !existingIds.has(c.id))
            .flatMap((c) => [
              {
                id: `gm_daily_${c.id.slice(0, 6)}`,
                circleId: c.id,
                title: 'Morning 5K Together',
                type: 'run' as const,
                targetKm: 5,
                progressKm: 2.5,
                deadline: 'Today, 21:00',
                status: 'in_progress' as const,
                cadence: 'daily' as const,
              },
              {
                id: `gm_weekly_${c.id.slice(0, 6)}`,
                circleId: c.id,
                title: 'Circle Mileage 40K',
                type: 'run' as const,
                targetKm: 40,
                progressKm: 18.4,
                deadline: 'Sun, 23:59',
                status: 'in_progress' as const,
                cadence: 'weekly' as const,
              },
            ]);
          return [...prev, ...extra];
        });
      } else {
        setBackendLeaderboard([]);
        setBackendMembers([]);
        setBombMissions([]);
      }

      await Promise.all([
        selectedCircle ? syncCircleLeaderboard(selectedCircle.id, me.id) : Promise.resolve(),
        syncQuests(selectedCircle?.id),
        syncActivities(selectedCircle),
      ]);

      return mappedCircles;
    } catch {
      return [];
    } finally {
      setHydrating(false);
    }
  }, [activeCircleId, mapBackendUser, syncActivities, syncCircleLeaderboard, syncQuests]);

  useEffect(() => {
    if (isAuthenticated && tokenStore.get()) {
      void hydrateFromBackend();
    }
  }, [isAuthenticated, hydrateFromBackend]);

  useEffect(() => {
    if (isAuthenticated && tokenStore.get() && activeCircleId) {
      void syncCircleLeaderboard(activeCircleId, user.id);
      void syncQuests(activeCircleId);
    }
  }, [activeCircleId, isAuthenticated, syncCircleLeaderboard, syncQuests, user.id]);

  const leaderboard = useMemo<LeaderboardEntry[]>(() => {
    if (backendLeaderboard) return backendLeaderboard;
    if (!activeCircle) return [];
    const others = leaderboardByCircle[activeCircle.id] ?? [];
    return [
      ...others,
      {
        user: { id: user.id, username: user.username },
        rankPoints: user.rankPoints,
        totalDistanceKm: +seasonDistanceKm.toFixed(1),
        availabilityStatus: user.availabilityStatus ?? 'AVAILABLE',
      },
    ]
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [backendLeaderboard, activeCircle, user, seasonDistanceKm]);

  const myRank = leaderboard.find((e) => e.user.id === user.id)?.rank ?? null;

  const membersOf = useCallback(
    (circleId: string): CircleMember[] => {
      const circle = circles.find((c) => c.id === circleId);
      const fromBackend = backendLeaderboard && circleId === activeCircle?.id;
      const captainId = fromBackend ? backendCaptainId : circle?.captainId;
      const list = fromBackend
        ? backendLeaderboard.map((e) => ({
            id: e.user.id,
            username: e.user.username,
            rankPoints: e.rankPoints,
            totalDistanceKm: e.totalDistanceKm,
            availabilityStatus: e.availabilityStatus ?? 'AVAILABLE',
            restUntil: e.restUntil ?? null,
          }))
        : [
            {
              id: user.id,
              username: user.username,
              rankPoints: user.rankPoints,
              totalDistanceKm: +seasonDistanceKm.toFixed(1),
              availabilityStatus: user.availabilityStatus ?? 'AVAILABLE',
              restUntil: user.restUntil ?? null,
            },
            ...(circleMembers[circleId] ?? []).map((m) => {
              const s = (leaderboardByCircle[circleId] ?? []).find((x) => x.user.id === m.id);
              const hasActiveSentToThem = bombMissions.some(
                (b) =>
                  b.direction === 'sent' &&
                  b.counterpart.id === m.id &&
                  (b.status === 'pending' || b.status === 'in_progress'),
              );
              return {
                ...m,
                rankPoints: s?.rankPoints ?? 0,
                totalDistanceKm: s?.totalDistanceKm ?? 0,
                availabilityStatus: (hasActiveSentToThem ? 'IN_MISSION' : 'AVAILABLE') as AvailabilityStatus,
                restUntil: null,
              };
            }),
          ];
      return list
        .map((m) => ({
          ...m,
          role: m.id === captainId ? ('captain' as const) : ('member' as const),
          isMe: m.id === user.id,
        }))
        .sort((a, b) => Number(b.role === 'captain') - Number(a.role === 'captain') || b.rankPoints - a.rankPoints);
    },
    [circles, activeCircle?.id, backendLeaderboard, backendCaptainId, user, seasonDistanceKm, bombMissions],
  );

  const login = useCallback(
    async (credentials?: AuthCredentials): Promise<{ circleCount: number }> => {
      const mode = credentials?.mode ?? 'login';
      const email = credentials?.email?.trim() || 'budi@cidash.id';
      const password = credentials?.password || 'password123';
      const name = credentials?.name?.trim() || email.split('@')[0];

      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const payload = mode === 'register' ? { name, email, password } : { email, password };

      const res = await post<{ accessToken: string; user: BackendUser }>(path, payload);
      tokenStore.set(res.accessToken);
      localStorage.setItem(AUTH_KEY, '1');
      setUser(mapBackendUser(res.user));
      setAuth(true);
      const loadedCircles = await hydrateFromBackend();
      return { circleCount: loadedCircles.length };
    },
    [hydrateFromBackend, mapBackendUser],
  );

  const updateProfileName = useCallback(
    (name: string) => {
      const trimmed = name.trim();
      if (trimmed.length < 2) return;
      setUser((u) => ({ ...u, username: trimmed }));
      toast('Profile name updated', 'success');
    },
    [toast],
  );

  const createCircle = useCallback(
    async (name: string): Promise<Circle> => {
      if (tokenStore.get()) {
        const res = await post<{
          squad: {
            id: string;
            name: string;
            inviteCode: string;
            isPremium?: boolean;
            totalMembers?: number;
            maxMembers?: number;
          };
        }>('/squads', { name: name.trim() });

        const circle: Circle = {
          id: res.squad.id,
          name: res.squad.name,
          code: res.squad.inviteCode,
          isPremium: Boolean(res.squad.isPremium),
          memberCount: res.squad.totalMembers ?? 1,
          maxMembers: res.squad.maxMembers ?? (res.squad.isPremium ? 25 : 5),
          captainId: user.id,
        };
        setCircles((cs) => [circle, ...cs.filter((c) => c.id !== circle.id)]);
        setActiveCircleId(circle.id);
        toast(`Circle "${circle.name}" created (Free tier · max 5 members)!`, 'success');
        return circle;
      }

      const circle: Circle = {
        id: newId('cir'),
        name,
        code: generateCircleCode(),
        isPremium: false,
        memberCount: 1,
        maxMembers: 5,
        captainId: user.id,
      };
      setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      toast(`Circle "${circle.name}" created (Free tier · max 5 members)!`, 'success');
      return circle;
    },
    [toast, user.id],
  );

  const joinCircle = useCallback(
    async (code: string): Promise<Circle> => {
      const normalized = code.trim().toUpperCase();
      if (tokenStore.get()) {
        const res = await post<{
          squad: {
            id: string;
            name: string;
            inviteCode: string;
            isPremium?: boolean;
            totalMembers?: number;
            maxMembers?: number;
          };
        }>('/squads/join', { inviteCode: normalized });

        const circle: Circle = {
          id: res.squad.id,
          name: res.squad.name,
          code: res.squad.inviteCode,
          isPremium: Boolean(res.squad.isPremium),
          memberCount: res.squad.totalMembers ?? 2,
          maxMembers: res.squad.maxMembers ?? (res.squad.isPremium ? 25 : 5),
        };
        setCircles((cs) => [circle, ...cs.filter((c) => c.id !== circle.id)]);
        setActiveCircleId(circle.id);
        toast(`Joined "${circle.name}" (${circle.memberCount}/${circle.maxMembers} members)!`, 'success');
        return circle;
      }

      const existing = circles.find((c) => c.code === normalized);
      if (existing) {
        const max = existing.maxMembers ?? (existing.isPremium ? 25 : 5);
        if (existing.memberCount >= max) {
          throw new Error(
            existing.isPremium
              ? `Premium Circle "${existing.name}" is at maximum capacity (${max}/${max} members).`
              : `Free Circle "${existing.name}" is full (${max}/${max} members). Upgrade to Premium to allow up to 25 members.`,
          );
        }
      }
      const circle = existing ?? {
        id: newId('cir'),
        name: `Circle ${normalized}`,
        code: normalized,
        isPremium: false,
        memberCount: 2,
        maxMembers: 5,
      };
      if (!existing) setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      toast(`Joined "${circle.name}"!`, 'success');
      return circle;
    },
    [circles, toast],
  );

  const upgradeCircle = useCallback(
    async (circleId: string): Promise<void> => {
      const upgradeCost = 100;
      const target = circles.find((c) => c.id === circleId);
      if (!target) return;
      if (target.isPremium) {
        toast('This circle is already on the Premium tier (max 25 members).', 'info');
        return;
      }
      if (user.coins < upgradeCost) {
        toast(`Need ${upgradeCost} coins to upgrade circle to Premium (up to 25 members).`, 'error');
        return;
      }

      if (tokenStore.get()) {
        try {
          const res = await post<{
            message: string;
            remainingCoinBalance: number;
            squad: { id: string; isPremium: boolean; maxMembers: number };
          }>(`/squads/${circleId}/upgrade`);
          setUser((u) => ({ ...u, coins: res.remainingCoinBalance }));
          setCircles((cs) =>
            cs.map((c) =>
              c.id === circleId
                ? { ...c, isPremium: true, maxMembers: res.squad.maxMembers ?? 25 }
                : c,
            ),
          );
          toast(res.message || 'Circle upgraded to Premium (max 25 members)!', 'success');
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Failed to upgrade circle', 'error');
        }
        return;
      }

      setUser((u) => ({ ...u, coins: u.coins - upgradeCost }));
      setCircles((cs) =>
        cs.map((c) => (c.id === circleId ? { ...c, isPremium: true, maxMembers: 25 } : c)),
      );
      toast(`"${target.name}" upgraded to Premium (max 25 members)!`, 'success');
    },
    [circles, toast, user.coins],
  );

  const leaveCircle = useCallback(
    async (circleId: string): Promise<void> => {
      if (tokenStore.get()) {
        const res = await post<{ message: string }>(`/squads/${circleId}/leave`);
        toast(res.message || 'Left circle', 'info');
        await hydrateFromBackend();
        return;
      }
      setCircles((cs) => {
        const remaining = cs.filter((c) => c.id !== circleId);
        if (activeCircleId === circleId) {
          setActiveCircleId(remaining[0]?.id ?? null);
        }
        return remaining;
      });
      toast('Left circle', 'info');
    },
    [activeCircleId, hydrateFromBackend, toast],
  );

  const kickMember = useCallback(
    async (circleId: string, targetUserId: string): Promise<void> => {
      if (tokenStore.get()) {
        const res = await del<{ message: string }>(`/squads/${circleId}/members/${targetUserId}`);
        toast(res.message || 'Member removed from circle', 'info');
        await syncCircleLeaderboard(circleId, user.id);
        await hydrateFromBackend();
        return;
      }
      toast('Member removed from circle', 'info');
    },
    [hydrateFromBackend, syncCircleLeaderboard, toast, user.id],
  );

  const topUp = useCallback(
    (coins: number) => {
      const previousCoins = user.coins;
      setUser((u) => ({ ...u, coins: u.coins + coins }));
      if (tokenStore.get()) {
        void post<{ coinBalance: number }>('/auth/top-up', { coins })
          .then((res) => {
            setUser((u) => ({ ...u, coins: res.coinBalance }));
            toast(`Added ${coins} coins to your wallet!`, 'success');
          })
          .catch((err) => {
            setUser((u) => ({ ...u, coins: previousCoins }));
            toast(err instanceof Error ? err.message : 'Top-up failed', 'error');
          });
      } else {
        toast(`Added ${coins} demo coins!`, 'success');
      }
    },
    [toast, user.coins],
  );

  const buyShield = useCallback(async (): Promise<void> => {
    const owned = user.shieldTickets ?? 0;
    const weeklyBought = user.weeklyShieldsBought ?? 0;

    if (owned >= MAX_SHIELD_TICKETS) {
      toast(`Inventory full (max ${MAX_SHIELD_TICKETS} Shield Tickets)`, 'error');
      return;
    }
    if (weeklyBought >= SHIELD_WEEKLY_COSTS.length) {
      toast(`Weekly limit reached (max ${SHIELD_WEEKLY_COSTS.length} shields/week to keep it fair)`, 'error');
      return;
    }

    const cost = user.nextShieldCost ?? SHIELD_WEEKLY_COSTS[weeklyBought] ?? 25;
    if (user.coins < cost) {
      toast(`Not enough coins! Need ${cost} coins to buy a Shield Ticket.`, 'error');
      return;
    }

    if (tokenStore.get()) {
      try {
        const res = await post<{
          message: string;
          user: BackendUser;
        }>('/auth/buy-shield');
        setUser(mapBackendUser(res.user));
        toast(res.message || `Purchased 1 Shield Ticket for ${cost} coins!`, 'success');
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Failed to buy Shield Ticket', 'error');
      }
      return;
    }

    const nextBought = weeklyBought + 1;
    const nextTickets = owned + 1;
    setUser((u) => ({
      ...u,
      coins: u.coins - cost,
      shieldTickets: nextTickets,
      weeklyShieldsBought: nextBought,
      nextShieldCost:
        nextTickets >= MAX_SHIELD_TICKETS || nextBought >= SHIELD_WEEKLY_COSTS.length
          ? null
          : SHIELD_WEEKLY_COSTS[nextBought],
    }));
    toast(`Purchased 1 Shield Ticket for ${cost} coins!`, 'success');
  }, [mapBackendUser, toast, user.coins, user.nextShieldCost, user.shieldTickets, user.weeklyShieldsBought]);

  const setAvailabilityStatus = useCallback(
    async (targetStatus: 'AVAILABLE' | 'RESTING'): Promise<void> => {
      if (tokenStore.get()) {
        try {
          const res = await post<{
            message: string;
            coinBalance: number;
            availabilityStatus: AvailabilityStatus;
            restUntil: string | null;
            weeklyRestUsed: number;
            nextRestCost: number | null;
          }>('/auth/status', { status: targetStatus });

          setUser((u) => ({
            ...u,
            coins: res.coinBalance,
            availabilityStatus: res.availabilityStatus,
            restUntil: res.restUntil,
            weeklyRestUsed: res.weeklyRestUsed,
            nextRestCost: res.nextRestCost,
          }));
          toast(res.message, 'success');
          if (activeCircle) {
            void syncCircleLeaderboard(activeCircle.id, user.id);
          }
        } catch (err) {
          toast(err instanceof Error ? err.message : 'Failed to update status', 'error');
        }
        return;
      }

      if (targetStatus === 'AVAILABLE') {
        const hasActiveIncoming = bombMissions.some(
          (b) => b.direction === 'incoming' && (b.status === 'pending' || b.status === 'in_progress'),
        );
        setUser((u) => ({
          ...u,
          availabilityStatus: hasActiveIncoming ? 'IN_MISSION' : 'AVAILABLE',
          restUntil: null,
        }));
        toast('Status set to Ready (Available for challenges)', 'success');
        return;
      }

      const hasActiveIncoming = bombMissions.some(
        (b) => b.direction === 'incoming' && (b.status === 'pending' || b.status === 'in_progress'),
      );
      if (hasActiveIncoming) {
        toast('Finish or resolve your active incoming Bomb Mission before entering Rest Mode.', 'error');
        return;
      }

      const used = user.weeklyRestUsed ?? 0;
      if (used >= REST_WEEKLY_COSTS.length) {
        toast(`Weekly Rest Mode limit reached (max ${REST_WEEKLY_COSTS.length}x/week).`, 'error');
        return;
      }
      const cost = REST_WEEKLY_COSTS[used];
      if (user.coins < cost) {
        toast(`Not enough coins! Need ${cost} coins for an extra 24h Rest Mode.`, 'error');
        return;
      }

      const nextUsed = used + 1;
      const restUntil = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
      setUser((u) => ({
        ...u,
        coins: u.coins - cost,
        availabilityStatus: 'RESTING',
        restUntil,
        weeklyRestUsed: nextUsed,
        nextRestCost: nextUsed >= REST_WEEKLY_COSTS.length ? null : REST_WEEKLY_COSTS[nextUsed],
      }));
      toast(
        cost > 0
          ? `Rest Mode enabled for 24h (${cost} coins)`
          : 'Free weekly Rest Mode enabled for 24h!',
        'success',
      );
    },
    [activeCircle, bombMissions, syncCircleLeaderboard, toast, user.coins, user.id, user.weeklyRestUsed],
  );

  const members = useMemo<TargetMemberInfo[]>(() => {
    if (backendMembers) return backendMembers;
    const raw = activeCircle ? (circleMembers[activeCircle.id] ?? []) : [];
    return raw.map((m) => {
      const hasActiveSentToThem = bombMissions.some(
        (b) =>
          b.direction === 'sent' &&
          b.counterpart.id === m.id &&
          (b.status === 'pending' || b.status === 'in_progress'),
      );
      return {
        ...m,
        availabilityStatus: hasActiveSentToThem ? 'IN_MISSION' : 'AVAILABLE',
        restUntil: null,
      };
    });
  }, [activeCircle, backendMembers, bombMissions]);

  const sendBomb = useCallback(
    (input: SendBombInput) => {
      if (user.availabilityStatus === 'RESTING') {
        toast('You are in Rest Mode. Switch to Ready before sending a Bomb Mission.', 'error');
        return;
      }

      const target = members.find((m) => m.id === input.targetUserId);
      if (!target || input.wagerCoins > user.coins) {
        toast('Not enough coins or invalid target member', 'error');
        return;
      }

      if (target.availabilityStatus === 'RESTING') {
        toast(`@${target.username} is currently in Rest Mode and cannot receive Bomb Missions.`, 'error');
        return;
      }

      if (target.availabilityStatus === 'IN_MISSION') {
        toast(`@${target.username} is already doing an active Bomb Mission (max 1 at a time).`, 'error');
        return;
      }

      const prevCoins = user.coins;
      setUser((u) => ({ ...u, coins: Math.max(0, u.coins - input.wagerCoins) }));
      const tempId = newId('bm');
      const optimisticMission: BombMission = {
        id: tempId,
        direction: 'sent',
        counterpart: { id: target.id, username: target.username },
        type: input.type,
        targetKm: input.targetKm,
        durationMin: input.durationMin,
        deadline: new Date(input.deadline).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }),
        wagerCoins: input.wagerCoins,
        rewardRankPoints: input.wagerCoins * 2,
        penaltyRankPoints: input.wagerCoins * 2,
        status: 'pending',
      };
      setBombMissions((bs) => [optimisticMission, ...bs]);

      if (tokenStore.get() && activeCircle) {
        const maxPace = +(input.durationMin / Math.max(0.5, input.targetKm)).toFixed(2);
        void post<{ remainingCoinBalance: number }>('/quests', {
          squadId: activeCircle.id,
          targetUserId: input.targetUserId,
          activityType: input.type === 'run' ? 'RUNNING' : 'CYCLING',
          targetDistance: Math.round(input.targetKm * 1000),
          targetMaxPace: maxPace,
          stakesPoints: input.wagerCoins * 2,
          wagerCoins: input.wagerCoins,
          rewardTitle: 'P2P Bomb Mission',
          deadline: new Date(input.deadline).toISOString(),
        })
          .then((res) => {
            setUser((u) => ({ ...u, coins: res.remainingCoinBalance }));
            toast(`Bomb Mission sent to @${target.username}!`, 'success');
            return Promise.all([
              syncQuests(activeCircle.id),
              syncCircleLeaderboard(activeCircle.id, user.id),
            ]);
          })
          .catch((err) => {
            setUser((u) => ({ ...u, coins: prevCoins }));
            setBombMissions((bs) => bs.filter((b) => b.id !== tempId));
            toast(err instanceof Error ? err.message : 'Failed to send Bomb Mission', 'error');
          });
      } else {
        toast(`Bomb Mission sent to @${target.username}!`, 'success');
      }
    },
    [activeCircle, members, syncCircleLeaderboard, syncQuests, toast, user.availabilityStatus, user.coins, user.id],
  );

  const acceptBomb = useCallback(
    (id: string) => {
      setBombMissions((bs) => bs.map((b) => (b.id === id ? { ...b, status: 'in_progress' } : b)));
      if (tokenStore.get()) {
        void post(`/quests/${id}/accept`)
          .then(() => {
            toast('Challenge accepted! Good luck!', 'success');
            return syncQuests(activeCircle?.id);
          })
          .catch((err) => {
            toast(err instanceof Error ? err.message : 'Failed to accept challenge', 'error');
            void syncQuests(activeCircle?.id);
          });
      } else {
        toast('Challenge accepted! Good luck!', 'success');
      }
    },
    [activeCircle?.id, syncQuests, toast],
  );

  const useShield = useCallback(
    (id: string) => {
      if ((user.shieldTickets ?? 0) < 1) {
        toast('You do not have any Shield Tickets left. Buy one with coins above!', 'error');
        return;
      }
      const targetQuest = bombMissions.find((b) => b.id === id);
      const refundPreview = targetQuest?.status === 'pending' ? Math.floor(targetQuest.wagerCoins / 2) : 0;

      setBombMissions((bs) => bs.filter((b) => b.id !== id));
      setUser((u) => {
        const nextTickets = Math.max(0, (u.shieldTickets ?? 1) - 1);
        const bought = u.weeklyShieldsBought ?? 0;
        return {
          ...u,
          shieldTickets: nextTickets,
          nextShieldCost:
            nextTickets >= MAX_SHIELD_TICKETS || bought >= SHIELD_WEEKLY_COSTS.length
              ? null
              : SHIELD_WEEKLY_COSTS[bought],
        };
      });
      if (tokenStore.get()) {
        void post<{ message?: string }>(`/quests/${id}/shield`)
          .then((res) => {
            toast(res.message || 'Shield Ticket used! Penalty neutralized.', 'success');
            return Promise.all([syncQuests(activeCircle?.id), hydrateFromBackend()]);
          })
          .catch((err) => {
            toast(err instanceof Error ? err.message : 'Failed to use Shield Ticket', 'error');
            void Promise.all([syncQuests(activeCircle?.id), hydrateFromBackend()]);
          });
      } else {
        toast(
          refundPreview > 0
            ? `Shield Ticket used! 0 RP penalty & ${refundPreview} coins (50%) refunded to @${targetQuest?.counterpart.username}.`
            : 'Shield Ticket used! Penalty neutralized.',
          'success',
        );
      }
    },
    [activeCircle?.id, bombMissions, hydrateFromBackend, syncQuests, toast, user.shieldTickets],
  );

  const snoozeBomb = useCallback(
    (id: string) => {
      const quest = bombMissions.find((b) => b.id === id);
      if (!quest) return;
      if (quest.snoozed) {
        toast('This mission has already been extended once (+12h max).', 'error');
        return;
      }
      if (user.coins < SNOOZE_COST_COINS) {
        toast(`Need ${SNOOZE_COST_COINS} coins to extend deadline by +12h.`, 'error');
        return;
      }

      if (tokenStore.get()) {
        void post<{
          message: string;
          remainingCoinBalance: number;
          deadline: string;
        }>(`/quests/${id}/snooze`)
          .then((res) => {
            setUser((u) => ({ ...u, coins: res.remainingCoinBalance }));
            toast(res.message || 'Deadline extended by +12 hours!', 'success');
            return syncQuests(activeCircle?.id);
          })
          .catch((err) => {
            toast(err instanceof Error ? err.message : 'Failed to extend deadline', 'error');
          });
        return;
      }

      setUser((u) => ({ ...u, coins: u.coins - SNOOZE_COST_COINS }));
      setBombMissions((bs) =>
        bs.map((b) =>
          b.id === id
            ? {
                ...b,
                snoozed: true,
                deadline: `${b.deadline} (+12h)`,
              }
            : b,
        ),
      );
      toast(`Deadline extended by +12 hours (-${SNOOZE_COST_COINS} coins)!`, 'success');
    },
    [activeCircle?.id, bombMissions, syncQuests, toast, user.coins],
  );

  const rejectBomb = useCallback(
    (id: string) => {
      const quest = bombMissions.find((b) => b.id === id);
      setBombMissions((bs) => bs.filter((b) => b.id !== id));
      if (tokenStore.get()) {
        void post<{ message?: string; shielded?: boolean; penaltyPoints?: number }>(`/quests/${id}/reject`)
          .then((res) => {
            if (res.shielded) {
              toast('Shield Ticket automatically used — 0 RP penalty!', 'info');
            } else {
              toast(`Mission declined (−${res.penaltyPoints ?? quest?.penaltyRankPoints ?? 0} RP)`, 'info');
            }
            return Promise.all([syncQuests(activeCircle?.id), hydrateFromBackend()]);
          })
          .catch((err) => {
            toast(err instanceof Error ? err.message : 'Failed to decline challenge', 'error');
            void Promise.all([syncQuests(activeCircle?.id), hydrateFromBackend()]);
          });
      } else {
        if ((user.shieldTickets ?? 0) >= 1) {
          setUser((u) => ({ ...u, shieldTickets: (u.shieldTickets ?? 1) - 1 }));
          toast('Shield Ticket automatically used — 0 RP penalty!', 'info');
        } else if (quest) {
          setUser((u) => ({ ...u, rankPoints: Math.max(0, u.rankPoints - quest.penaltyRankPoints) }));
          toast(`Mission declined (−${quest.penaltyRankPoints} RP)`, 'info');
        }
      }
    },
    [activeCircle?.id, bombMissions, hydrateFromBackend, syncQuests, toast, user.shieldTickets],
  );

  const recordActivity = useCallback(
    (input: RecordActivityInput): VerificationResult => {
      const base = { distanceKm: input.distanceKm, durationSec: input.durationSec };

      if (input.speedViolation) {
        return {
          ...base,
          valid: false,
          reason: 'Unrealistic speed detected (looks like a motor vehicle).',
          rankPointsDelta: 0,
        };
      }
      if (input.distanceKm < 0.05) {
        return {
          ...base,
          valid: false,
          reason: 'Distance too short to verify (min. 50 m).',
          rankPointsDelta: 0,
        };
      }

      const prevRankPoints = user.rankPoints;
      const prevSeasonDistance = seasonDistanceKm;
      let rankPointsDelta = Math.max(10, Math.floor(input.distanceKm) * 10);
      let missionStatus: VerificationResult['missionStatus'];

      const bomb = bombMissions.find((b) => b.id === input.missionId);
      const group = groupMissions.find((g) => g.id === input.missionId);

      if (bomb) {
        const success = input.distanceKm >= bomb.targetKm && input.durationSec <= bomb.durationMin * 60;
        missionStatus = success ? 'completed' : 'failed';
        rankPointsDelta = success ? baseRankPlusQuest(input.distanceKm, bomb.rewardRankPoints) : -bomb.penaltyRankPoints;
        setBombMissions((bs) => bs.map((b) => (b.id === bomb.id ? { ...b, status: missionStatus! } : b)));
      } else if (group) {
        const progressKm = +(group.progressKm + input.distanceKm).toFixed(2);
        missionStatus = progressKm >= group.targetKm ? 'completed' : 'in_progress';
        if (missionStatus === 'completed') rankPointsDelta += 20;
        setGroupMissions((gs) => gs.map((g) => (g.id === group.id ? { ...g, progressKm, status: missionStatus! } : g)));
      }

      setUser((u) => ({ ...u, rankPoints: Math.max(0, u.rankPoints + rankPointsDelta) }));
      setSeasonDistanceKm((d) => d + input.distanceKm);
      const logId = newId('act');
      const log: ActivityLog = {
        id: logId,
        type: input.type,
        mode: input.mode,
        distanceKm: +input.distanceKm.toFixed(2),
        durationSec: input.durationSec,
        date: new Date().toLocaleDateString('en-US', { dateStyle: 'medium' }),
        routeLabel: bomb
          ? `Bomb from ${bomb.counterpart.username}`
          : (group?.title ?? input.locationLabel ?? (input.mode === 'group' ? 'Group Run' : 'Free workout')),
        missionStatus: missionStatus ?? 'completed',
        route: input.route,
        locationLabel: input.locationLabel ?? null,
        elevationGain: input.elevationGain ?? 0,
        circle: activeCircle ? { name: activeCircle.name, code: activeCircle.code } : null,
      };
      setActivityHistory((h) => [log, ...h]);

      if (tokenStore.get()) {
        const durationSeconds = Math.max(10, Math.round(input.durationSec));
        const distanceMeters = Math.max(50, Math.round(input.distanceKm * 1000));
        const averagePace = +(durationSeconds / 60 / (distanceMeters / 1000)).toFixed(2);
        const endedAt = new Date();
        // Waktu mulai asli sesi (termasuk jeda); fallback ke durasi bersih untuk alur lama.
        const startedAt = new Date(input.startedAt ?? endedAt.getTime() - durationSeconds * 1000);
        // Rute lengkap = SATU encoded polyline (presisi 5), bukan array koordinat/GeoJSON.
        const encodedPolyline =
          input.route.length >= 2
            ? encodeRoute(input.route)
            : encodePolyline(buildConsistentCoordinates(input.route, distanceMeters).map(([lng, lat]) => [lat, lng]));

        void post<{
          rewards?: { currentRankPoints: number; totalPointsGained: number };
        }>('/activities', {
          ...(input.sessionId ? { id: input.sessionId } : {}),
          type: input.type === 'run' ? 'RUNNING' : 'CYCLING',
          distanceMeters,
          durationSeconds,
          averagePace,
          encodedPolyline,
          elevationGain: Math.round(input.elevationGain ?? 0),
          ...(input.locationLabel ? { locationLabel: input.locationLabel } : {}),
          startedAt: startedAt.toISOString(),
          endedAt: endedAt.toISOString(),
        })
          .then((res) => {
            if (res.rewards?.currentRankPoints !== undefined) {
              setUser((u) => ({ ...u, rankPoints: res.rewards!.currentRankPoints }));
            }
            return Promise.all([
              activeCircle ? syncCircleLeaderboard(activeCircle.id, user.id) : Promise.resolve(),
              syncQuests(activeCircle?.id),
              syncActivities(activeCircle),
            ]);
          })
          .catch((err) => {
            // Rollback optimistic update on backend anti-cheat rejection
            setUser((u) => ({ ...u, rankPoints: prevRankPoints }));
            setSeasonDistanceKm(prevSeasonDistance);
            setActivityHistory((h) => h.filter((item) => item.id !== logId));
            toast(
              err instanceof Error ? err.message : 'Activity rejected by server verification',
              'error',
            );
          });
      }

      return { ...base, valid: true, rankPointsDelta, missionStatus, log };
    },
    [
      activeCircle,
      bombMissions,
      groupMissions,
      seasonDistanceKm,
      syncActivities,
      syncCircleLeaderboard,
      syncQuests,
      toast,
      user.id,
      user.rankPoints,
    ],
  );

  const value: AppState = {
    isAuthenticated,
    hydrating,
    user,
    circles,
    activeCircle,
    members,
    membersOf,
    leaderboard,
    myRank,
    groupMissions: groupMissions.filter((g) => g.circleId === activeCircle?.id),
    bombMissions,
    activityHistory,
    login,
    logout,
    updateProfileName,
    setActiveCircle: setActiveCircleId,
    createCircle,
    joinCircle,
    upgradeCircle,
    leaveCircle,
    kickMember,
    topUp,
    buyShield,
    setAvailabilityStatus,
    sendBomb,
    acceptBomb,
    rejectBomb,
    useShield,
    snoozeBomb,
    recordActivity,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function baseRankPlusQuest(distanceKm: number, questBonus: number): number {
  return Math.max(10, Math.floor(distanceKm) * 10) + questBonus;
}

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
}
