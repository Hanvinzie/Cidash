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
import { http, post, tokenStore } from '../services/http';
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

const AUTH_KEY = 'cidash_auth';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

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
}

interface BackendUser {
  id: string;
  email: string;
  name: string;
  coinBalance: number;
  rankPoints: number;
  shieldTickets: number;
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

  login: (credentials?: AuthCredentials) => Promise<void>;
  logout: () => void;
  setActiveCircle: (id: string) => void;
  createCircle: (name: string) => Promise<Circle>;
  joinCircle: (code: string) => Promise<Circle>;
  topUp: (coins: number) => void;
  sendBomb: (input: SendBombInput) => void;
  acceptBomb: (id: string) => void;
  rejectBomb: (id: string) => void;
  recordActivity: (input: RecordActivityInput) => VerificationResult;
}

const AppContext = createContext<AppState | null>(null);

function parseGeoJsonRoute(routeGeoJson: unknown): GeoPoint[] {
  if (!routeGeoJson || typeof routeGeoJson !== 'object') return [];
  const geo = routeGeoJson as {
    coordinates?: unknown;
    features?: { geometry?: { coordinates?: unknown } }[];
  };
  const rawCoords = Array.isArray(geo.coordinates)
    ? geo.coordinates
    : Array.isArray(geo.features?.[0]?.geometry?.coordinates)
      ? geo.features![0].geometry!.coordinates!
      : [];

  const now = Date.now();
  return rawCoords
    .filter((c): c is [number, number] => Array.isArray(c) && c.length >= 2)
    .map(([lng, lat], idx) => ({
      lat: Number(lat),
      lng: Number(lng),
      timestamp: now + idx * 1000,
    }));
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuth] = useState(
    () => localStorage.getItem(AUTH_KEY) === '1' || Boolean(tokenStore.get()),
  );
  const [user, setUser] = useState<User>(initialUser);
  const [seasonDistanceKm, setSeasonDistanceKm] = useState(61.1);
  const [circles, setCircles] = useState<Circle[]>(initialCircles);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(initialCircles[0]?.id ?? null);
  const [backendLeaderboard, setBackendLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [backendMembers, setBackendMembers] = useState<Pick<User, 'id' | 'username'>[] | null>(null);
  const [groupMissions, setGroupMissions] = useState<GroupMission[]>(initialGroupMissions);
  const [bombMissions, setBombMissions] = useState<BombMission[]>(initialBombMissions);
  const [activityHistory, setActivityHistory] = useState<ActivityLog[]>(initialActivityHistory);

  const activeCircle = circles.find((c) => c.id === activeCircleId) ?? circles[0] ?? null;

  const mapBackendUser = useCallback((u: BackendUser): User => ({
    id: u.id,
    username: u.name,
    rankPoints: u.rankPoints,
    coins: u.coinBalance,
  }), []);

  const syncCircleLeaderboard = useCallback(async (circleId: string, currentUserId: string) => {
    try {
      const res = await http<{
        leaderboard: {
          rank: number;
          userId: string;
          name: string;
          rankPoints: number;
          totalDistanceKm?: number;
        }[];
      }>(`/squads/${circleId}/leaderboard`);

      const entries: LeaderboardEntry[] = res.leaderboard.map((item) => ({
        rank: item.rank,
        user: { id: item.userId, username: item.name },
        rankPoints: item.rankPoints,
        totalDistanceKm: item.totalDistanceKm ?? 0,
      }));
      setBackendLeaderboard(entries);
      setBackendMembers(
        res.leaderboard
          .filter((item) => item.userId !== currentUserId)
          .map((item) => ({ id: item.userId, username: item.name })),
      );
    } catch {
      setBackendLeaderboard(null);
      setBackendMembers(null);
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
          wagerCoins: 20,
          rewardRankPoints: q.stakesPoints,
          penaltyRankPoints: q.stakesPoints,
          status:
            q.status === 'ACCEPTED'
              ? 'in_progress'
              : q.status === 'COMPLETED'
                ? 'completed'
                : q.status === 'FAILED'
                  ? 'failed'
                  : 'pending',
        };
      });
      setBombMissions(mapped);
    } catch {
      // Biarkan state lokal jika gagal
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
          routeGeoJson?: unknown;
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
        durationSec: a.durationSeconds,
        date: new Date(a.startedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }),
        routeLabel: a.completedQuest?.rewardTitle ?? 'Recorded workout',
        missionStatus: 'completed',
        route: parseGeoJsonRoute(a.routeGeoJson),
        circle: currentCircle ? { name: currentCircle.name, code: currentCircle.code } : null,
      }));
      setActivityHistory(logs);
    } catch {
      // Biarkan state lokal jika gagal
    }
  }, []);

  const hydrateFromBackend = useCallback(async () => {
    const token = tokenStore.get();
    if (!token) return;

    try {
      const [me, mySquadsRes] = await Promise.all([
        http<BackendUser>('/auth/me'),
        http<{
          squads: {
            id: string;
            name: string;
            inviteCode: string;
            totalMembers: number;
          }[];
        }>('/squads/my'),
      ]);

      const mappedUser = mapBackendUser(me);
      setUser(mappedUser);

      const mappedCircles: Circle[] = mySquadsRes.squads.map((s) => ({
        id: s.id,
        name: s.name,
        code: s.inviteCode,
        memberCount: s.totalMembers,
      }));

      setCircles(mappedCircles);
      const selectedCircle = mappedCircles[0] ?? null;
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
      }

      await Promise.all([
        selectedCircle ? syncCircleLeaderboard(selectedCircle.id, me.id) : Promise.resolve(),
        syncQuests(selectedCircle?.id),
        syncActivities(selectedCircle),
      ]);
    } catch {
      // Biarkan state yang ada
    }
  }, [mapBackendUser, syncActivities, syncCircleLeaderboard, syncQuests]);

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
      },
    ]
      .sort((a, b) => b.rankPoints - a.rankPoints)
      .map((e, i) => ({ ...e, rank: i + 1 }));
  }, [backendLeaderboard, activeCircle, user, seasonDistanceKm]);

  const myRank = leaderboard.find((e) => e.user.id === user.id)?.rank ?? null;

  const login = useCallback(
    async (credentials?: AuthCredentials) => {
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
      await hydrateFromBackend();
    },
    [hydrateFromBackend, mapBackendUser],
  );

  const logout = useCallback(() => {
    tokenStore.clear();
    localStorage.removeItem(AUTH_KEY);
    setBackendLeaderboard(null);
    setBackendMembers(null);
    setAuth(false);
  }, []);

  const createCircle = useCallback(
    async (name: string): Promise<Circle> => {
      if (tokenStore.get()) {
        const res = await post<{
          squad: { id: string; name: string; inviteCode: string; totalMembers?: number };
        }>('/squads', { name: name.trim() });

        const circle: Circle = {
          id: res.squad.id,
          name: res.squad.name,
          code: res.squad.inviteCode,
          memberCount: res.squad.totalMembers ?? 1,
        };
        setCircles((cs) => [circle, ...cs.filter((c) => c.id !== circle.id)]);
        setActiveCircleId(circle.id);
        return circle;
      }

      const circle: Circle = { id: newId('cir'), name, code: generateCircleCode(), memberCount: 1 };
      setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      return circle;
    },
    [],
  );

  const joinCircle = useCallback(
    async (code: string): Promise<Circle> => {
      const normalized = code.trim().toUpperCase();
      if (tokenStore.get()) {
        const res = await post<{
          squad: { id: string; name: string; inviteCode: string; totalMembers?: number };
        }>('/squads/join', { inviteCode: normalized });

        const circle: Circle = {
          id: res.squad.id,
          name: res.squad.name,
          code: res.squad.inviteCode,
          memberCount: res.squad.totalMembers ?? 2,
        };
        setCircles((cs) => [circle, ...cs.filter((c) => c.id !== circle.id)]);
        setActiveCircleId(circle.id);
        return circle;
      }

      const existing = circles.find((c) => c.code === normalized);
      const circle = existing ?? { id: newId('cir'), name: `Circle ${normalized}`, code: normalized, memberCount: 2 };
      if (!existing) setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      return circle;
    },
    [circles],
  );

  const topUp = useCallback((coins: number) => {
    setUser((u) => ({ ...u, coins: u.coins + coins }));
    if (tokenStore.get()) {
      void post<{ coinBalance: number }>('/auth/top-up', { coins })
        .then((res) => {
          setUser((u) => ({ ...u, coins: res.coinBalance }));
        })
        .catch(() => undefined);
    }
  }, []);

  const sendBomb = useCallback(
    (input: SendBombInput) => {
      const allMembers = backendMembers ?? Object.values(circleMembers).flat();
      const target = allMembers.find((m) => m.id === input.targetUserId);
      if (!target || input.wagerCoins > user.coins) return;

      setUser((u) => ({ ...u, coins: Math.max(0, u.coins - input.wagerCoins) }));
      const tempId = newId('bm');
      setBombMissions((bs) => [
        {
          id: tempId,
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

      if (tokenStore.get() && activeCircle) {
        const maxPace = +(input.durationMin / Math.max(0.5, input.targetKm)).toFixed(2);
        void post<{ remainingCoinBalance: number }>('/quests', {
          squadId: activeCircle.id,
          targetUserId: input.targetUserId,
          activityType: input.type === 'run' ? 'RUNNING' : 'CYCLING',
          targetDistance: Math.round(input.targetKm * 1000),
          targetMaxPace: maxPace,
          stakesPoints: input.wagerCoins * 2,
          rewardTitle: 'P2P Bomb Mission',
          deadline: new Date(input.deadline).toISOString(),
        })
          .then((res) => {
            setUser((u) => ({ ...u, coins: res.remainingCoinBalance }));
            return syncQuests(activeCircle.id);
          })
          .catch(() => undefined);
      }
    },
    [activeCircle, backendMembers, syncQuests, user.coins],
  );

  const acceptBomb = useCallback(
    (id: string) => {
      setBombMissions((bs) => bs.map((b) => (b.id === id ? { ...b, status: 'in_progress' } : b)));
      if (tokenStore.get()) {
        void post(`/quests/${id}/accept`)
          .then(() => syncQuests(activeCircle?.id))
          .catch(() => undefined);
      }
    },
    [activeCircle?.id, syncQuests],
  );

  const rejectBomb = useCallback(
    (id: string) => {
      setBombMissions((bs) => bs.filter((b) => b.id !== id));
      if (tokenStore.get()) {
        void post(`/quests/${id}/reject`)
          .then(() => Promise.all([syncQuests(activeCircle?.id), hydrateFromBackend()]))
          .catch(() => undefined);
      }
    },
    [activeCircle?.id, hydrateFromBackend, syncQuests],
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

      let rankPointsDelta = Math.max(10, Math.floor(input.distanceKm) * 10);
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

      if (tokenStore.get()) {
        const durationSeconds = Math.max(10, Math.round(input.durationSec));
        const distanceMeters = Math.max(50, Math.round(input.distanceKm * 1000));
        const averagePace = +((durationSeconds / 60) / (distanceMeters / 1000)).toFixed(2);
        const endedAt = new Date();
        const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
        const coordinates =
          input.route.length >= 2
            ? input.route.map((p) => [p.lng, p.lat])
            : [
                [106.802, -6.218],
                [106.805, -6.215],
              ];

        void post<{
          rewards?: { currentRankPoints: number };
        }>('/activities', {
          type: input.type === 'run' ? 'RUNNING' : 'CYCLING',
          distanceMeters,
          durationSeconds,
          averagePace,
          routeGeoJson: {
            type: 'LineString',
            coordinates,
          },
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
          .catch(() => undefined);
      }

      return { ...base, valid: true, rankPointsDelta, missionStatus, log };
    },
    [activeCircle, bombMissions, groupMissions, syncActivities, syncCircleLeaderboard, syncQuests, user.id],
  );

  const members = useMemo(() => {
    if (backendMembers) return backendMembers;
    return activeCircle ? circleMembers[activeCircle.id] ?? [] : [];
  }, [activeCircle, backendMembers]);

  const value: AppState = {
    isAuthenticated,
    user,
    circles,
    activeCircle,
    members,
    leaderboard,
    myRank,
    groupMissions: groupMissions.filter((g) => g.circleId === activeCircle?.id),
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
