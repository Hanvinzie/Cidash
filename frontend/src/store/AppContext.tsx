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
import { useToast } from './ToastContext';
import type {
  ActivityLog,
  ActivityType,
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
  hydrating: boolean;
  user: User;
  circles: Circle[];
  activeCircle: Circle | null;
  members: Pick<User, 'id' | 'username'>[];
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
  leaveCircle: (circleId: string) => Promise<void>;
  kickMember: (circleId: string, targetUserId: string) => Promise<void>;
  topUp: (coins: number) => void;
  sendBomb: (input: SendBombInput) => void;
  acceptBomb: (id: string) => void;
  rejectBomb: (id: string) => void;
  useShield: (id: string) => void;
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
  const [user, setUser] = useState<User>({ ...initialUser, shieldTickets: 1 });
  const [seasonDistanceKm, setSeasonDistanceKm] = useState(hasToken ? 0 : 61.1);
  const [circles, setCircles] = useState<Circle[]>(hasToken ? [] : initialCircles);
  const [activeCircleId, setActiveCircleId] = useState<string | null>(
    hasToken ? null : (initialCircles[0]?.id ?? null),
  );
  const [backendLeaderboard, setBackendLeaderboard] = useState<LeaderboardEntry[] | null>(null);
  const [backendMembers, setBackendMembers] = useState<Pick<User, 'id' | 'username'>[] | null>(null);
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
        }[];
      }>(`/squads/${circleId}/leaderboard`);

      const entries: LeaderboardEntry[] = res.leaderboard.map((item) => ({
        rank: item.rank,
        user: { id: item.userId, username: item.name },
        rankPoints: item.rankPoints,
        totalDistanceKm: item.totalDistanceKm ?? 0,
      }));
      setBackendLeaderboard(entries);
      setBackendCaptainId(res.leaderboard.find((item) => item.role === 'CAPTAIN')?.userId ?? null);
      setBackendMembers(
        res.leaderboard
          .filter((item) => item.userId !== currentUserId)
          .map((item) => ({ id: item.userId, username: item.name })),
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
        durationSeconds: a.durationSeconds,
        durationSec: a.durationSeconds,
        date: new Date(a.startedAt).toLocaleDateString('en-US', { dateStyle: 'medium' }),
        routeLabel: a.completedQuest?.rewardTitle ?? 'Recorded workout',
        missionStatus: 'completed',
        route: parseGeoJsonRoute(a.routeGeoJson),
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
            totalMembers: number;
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
        memberCount: s.totalMembers,
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
          }))
        : [
            {
              id: user.id,
              username: user.username,
              rankPoints: user.rankPoints,
              totalDistanceKm: +seasonDistanceKm.toFixed(1),
            },
            ...(circleMembers[circleId] ?? []).map((m) => {
              const s = (leaderboardByCircle[circleId] ?? []).find((x) => x.user.id === m.id);
              return { ...m, rankPoints: s?.rankPoints ?? 0, totalDistanceKm: s?.totalDistanceKm ?? 0 };
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
    [circles, activeCircle?.id, backendLeaderboard, backendCaptainId, user, seasonDistanceKm],
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
          squad: { id: string; name: string; inviteCode: string; totalMembers?: number };
        }>('/squads', { name: name.trim() });

        const circle: Circle = {
          id: res.squad.id,
          name: res.squad.name,
          code: res.squad.inviteCode,
          memberCount: res.squad.totalMembers ?? 1,
          captainId: user.id,
        };
        setCircles((cs) => [circle, ...cs.filter((c) => c.id !== circle.id)]);
        setActiveCircleId(circle.id);
        toast(`Circle "${circle.name}" created!`, 'success');
        return circle;
      }

      const circle: Circle = { id: newId('cir'), name, code: generateCircleCode(), memberCount: 1, captainId: user.id };
      setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      toast(`Circle "${circle.name}" created!`, 'success');
      return circle;
    },
    [toast, user.id],
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
        toast(`Joined "${circle.name}"!`, 'success');
        return circle;
      }

      const existing = circles.find((c) => c.code === normalized);
      const circle = existing ?? { id: newId('cir'), name: `Circle ${normalized}`, code: normalized, memberCount: 2 };
      if (!existing) setCircles((cs) => [...cs, circle]);
      setActiveCircleId(circle.id);
      toast(`Joined "${circle.name}"!`, 'success');
      return circle;
    },
    [circles, toast],
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

  const sendBomb = useCallback(
    (input: SendBombInput) => {
      const allMembers = backendMembers ?? Object.values(circleMembers).flat();
      const target = allMembers.find((m) => m.id === input.targetUserId);
      if (!target || input.wagerCoins > user.coins) {
        toast('Not enough coins or invalid target member', 'error');
        return;
      }

      const prevCoins = user.coins;
      setUser((u) => ({ ...u, coins: Math.max(0, u.coins - input.wagerCoins) }));
      const tempId = newId('bm');
      const optimisticMission: BombMission = {
        id: tempId,
        direction: 'sent',
        counterpart: target,
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
            return syncQuests(activeCircle.id);
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
    [activeCircle, backendMembers, syncQuests, toast, user.coins],
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
        toast('You do not have any Shield Tickets left', 'error');
        return;
      }
      setBombMissions((bs) => bs.filter((b) => b.id !== id));
      setUser((u) => ({ ...u, shieldTickets: Math.max(0, (u.shieldTickets ?? 1) - 1) }));
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
        toast('Shield Ticket used! Penalty neutralized.', 'success');
      }
    },
    [activeCircle?.id, hydrateFromBackend, syncQuests, toast, user.shieldTickets],
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
          : (group?.title ?? (input.mode === 'group' ? 'Group Run' : 'Free workout')),
        missionStatus: missionStatus ?? 'completed',
        route: input.route,
        circle: activeCircle ? { name: activeCircle.name, code: activeCircle.code } : null,
      };
      setActivityHistory((h) => [log, ...h]);

      if (tokenStore.get()) {
        const durationSeconds = Math.max(10, Math.round(input.durationSec));
        const distanceMeters = Math.max(50, Math.round(input.distanceKm * 1000));
        const averagePace = +(durationSeconds / 60 / (distanceMeters / 1000)).toFixed(2);
        const endedAt = new Date();
        const startedAt = new Date(endedAt.getTime() - durationSeconds * 1000);
        const coordinates = buildConsistentCoordinates(input.route, distanceMeters);

        void post<{
          rewards?: { currentRankPoints: number; totalPointsGained: number };
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

  const members = useMemo(() => {
    if (backendMembers) return backendMembers;
    return activeCircle ? (circleMembers[activeCircle.id] ?? []) : [];
  }, [activeCircle, backendMembers]);

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
    leaveCircle,
    kickMember,
    topUp,
    sendBomb,
    acceptBomb,
    rejectBomb,
    useShield,
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
