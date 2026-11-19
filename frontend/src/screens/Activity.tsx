import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import RunnerLoader from '../components/ui/RunnerLoader';
import NoCircleGate from '../components/circle/NoCircleGate';
import GroupRunPanel from '../components/activity/GroupRunPanel';
import LocationPrompt from '../components/activity/LocationPrompt';
import MissionSuggestModal, { type SuggestedMission } from '../components/activity/MissionSuggestModal';
import PlanSheet, { type PlanOption } from '../components/activity/PlanSheet';
import RecordingScreen from '../components/activity/RecordingScreen';
import VerificationModal from '../components/activity/VerificationModal';
import CircleRequiredGate from '../components/circle/CircleRequiredGate';
import { RouteMap, ShareCardModal } from '../lazyScreens';
import { useApp } from '../store/AppContext';
import { useRunSession } from '../store/RunSession';
import { useToast } from '../store/ToastContext';
import { requestCompassPermission } from '../lib/compass';
import { detectSpeedViolation, formatDuration } from '../lib/geo';
import { fallbackLabel, resolveActivityLabel } from '../lib/geocode';
import { LocationError, requestPosition, watchPermission, type LocationIssue } from '../lib/location';
import { SETTING_KEYS, useBooleanSetting } from '../lib/settings';
import { ROUTES } from '../routes';
import type { ActivityLog, ActivityType, RunMode, VerificationResult } from '../types';

const FREE_RUN = 'free:run';
const FREE_RIDE = 'free:bike';
const GROUP = 'group';
const WEAK_SIGNAL = "Couldn't find your location. Make sure GPS is on and you're in an open area.";
/** Aktivitas di bawah ini tidak mendapat poin, jadi tidak perlu memanggil geocoding. */
const MIN_GEOCODE_KM = 0.05;
const MAX_SUGGESTIONS = 3;
/** Bila pengguna menolak saran misi, jangan tanya lagi selama sesi aplikasi ini (hilang saat tab/app ditutup). */
const SKIP_SUGGEST_KEY = 'cidash_skip_mission_suggest';

const suggestSkipped = () => {
  try {
    return sessionStorage.getItem(SKIP_SUGGEST_KEY) === '1';
  } catch {
    return false;
  }
};

type BlockingIssue = Exclude<LocationIssue, 'timeout'>;

export default function Activity() {
  return (
    <NoCircleGate feature="activity">
      <ActivityScreen />
    </NoCircleGate>
  );
}

function ActivityScreen() {
  const { user, activeCircle, groupMissions, bombMissions, recordActivity } = useApp();
  const { tracker, group, live } = useRunSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { status, accuracyMeters, points, start: startTracking, resume: resumeTracking } = tracker;
  const tracking = status === 'running' || status === 'paused';

  /** Patch some query params (?mode, ?mission, ?room, ?type) without dropping the others. */
  const patchParams = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true },
    );

  // ---- Rencana: jenis aktivitas terkunci mengikuti Circle aktif (lari / sepeda) ----
  const circleType: ActivityType = activeCircle?.activityType ?? 'run';
  const mode: RunMode = params.get('mode') === 'group' || group.room ? 'group' : 'solo';
  const openGroup = groupMissions.filter((m) => m.status !== 'completed' && m.type === circleType);
  const openBombs = bombMissions.filter(
    (b) => b.direction === 'incoming' && b.status === 'in_progress' && b.type === circleType,
  );
  const requested = params.get('mission');
  const mission =
    openBombs.find((b) => b.id === requested) ?? openGroup.find((g) => g.id === requested) ?? undefined;
  const activityType: ActivityType = circleType;
  const planId = mission ? mission.id : mode === 'group' ? GROUP : circleType === 'bike' ? FREE_RIDE : FREE_RUN;

  const planOptions = useMemo<PlanOption[]>(
    () => [
      circleType === 'bike'
        ? { id: FREE_RIDE, label: 'Free ride', description: 'No goal, just ride', icon: 'activity', group: 'Quick start' }
        : { id: FREE_RUN, label: 'Free run', description: 'No goal, just run', icon: 'activity', group: 'Quick start' },
      ...(activeCircle
        ? [
            {
              id: GROUP,
              label: circleType === 'bike' ? 'Group ride' : 'Group run',
              description:
                circleType === 'bike' ? 'Ride together, live with your circle' : 'Run together, live with your circle',
              icon: 'users' as const,
              group: 'Together',
            },
          ]
        : []),
      ...openGroup.map((m) => ({
        id: m.id,
        label: m.title,
        description: `${m.progressKm} / ${m.targetKm} km · due ${m.deadline}`,
        icon: 'target' as const,
        group: 'Circle missions',
      })),
      ...openBombs.map((b) => ({
        id: b.id,
        label: `From @${b.counterpart.username}`,
        description: `${b.targetKm} km in ${b.durationMin} min · ${b.wagerCoins} coins`,
        icon: 'quest' as const,
        group: 'Bomb Missions',
      })),
    ],
    [activeCircle, circleType, openGroup, openBombs],
  );
  const plan = planOptions.find((o) => o.id === planId) ?? planOptions[0];

  function selectPlan(id: string) {
    // Meninggalkan Group run → keluar dari room agar tidak tertinggal di lobby.
    if (id !== GROUP && group.room) void group.leave();
    if (id === FREE_RUN) patchParams({ mission: null, mode: null, room: null, type: null });
    else if (id === FREE_RIDE) patchParams({ mission: null, mode: null, room: null, type: 'bike' });
    else if (id === GROUP) patchParams({ mission: null, mode: 'group', type: null });
    else patchParams({ mission: id, mode: null, room: null, type: null });
  }

  // Mode simulasi diatur dari Profile → Settings. `forceSim` = user memilih simulasi dari panduan GPS.
  const [simSetting] = useBooleanSetting(SETTING_KEYS.simulate, false);
  const [devMode] = useBooleanSetting(SETTING_KEYS.devMode, false);
  const [forceSim, setForceSim] = useState(false);
  // Simulasi hanya berlaku bila opsi pengembang terbuka (disembunyikan dari pengguna awam).
  const simulate = devMode && (simSetting || forceSim);

  const [planOpen, setPlanOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [shareLog, setShareLog] = useState<ActivityLog | null>(null);

  // ---- Location pre-run check ----
  const [here, setHere] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [prompt, setPrompt] = useState<BlockingIssue | null>(null);
  /** 'check' = hanya memastikan izin + GPS (saat tab dibuka), tanpa mulai merekam. */
  const pendingAction = useRef<'check' | 'start' | 'resume'>('check');

  /** Pastikan izin + GPS aktif, lalu jalankan aksi. Gagal → panduan (modal) atau toast. */
  const withLocation = useCallback(
    async (action: 'check' | 'start' | 'resume') => {
      pendingAction.current = action;
      setLocating(true);
      try {
        const pos = await requestPosition(8_000);
        const point = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp || Date.now(),
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          altitude: pos.coords.altitude,
          altitudeAccuracy: pos.coords.altitudeAccuracy,
        };
        setHere(point);
        setPrompt(null);
        if (action === 'start') startTracking(false, point, activityType);
        else if (action === 'resume') resumeTracking();
      } catch (e) {
        const issue = e instanceof LocationError ? e.issue : 'unavailable';
        if (issue === 'timeout') toast(WEAK_SIGNAL, 'error');
        else setPrompt(issue);
      } finally {
        setLocating(false);
      }
    },
    [startTracking, resumeTracking, toast, activityType],
  );

  // Setiap kali tab Activity dibuka: langsung minta izin lokasi (prompt native) / cek GPS,
  // supaya saat user menekan Start lokasi sudah siap. Dilewati bila sedang merekam.
  const checkedOnEnter = useRef(false);
  useEffect(() => {
    if (!activeCircle || checkedOnEnter.current || status !== 'idle' || simulate) return;
    checkedOnEnter.current = true;
    void withLocation('check');
  }, [activeCircle, status, simulate, withLocation]);

  // Izin diubah dari pengaturan saat modal terbuka → lanjutkan otomatis.
  useEffect(() => {
    if (!prompt) return;
    return watchPermission((state) => state === 'granted' && void withLocation(pendingAction.current));
  }, [prompt, withLocation]);

  // Masalah lokasi saat sedang merekam.
  useEffect(() => {
    if (!tracker.issue) return;
    if (tracker.issue === 'timeout') toast('Weak GPS signal — keep moving in an open area.', 'info');
    else {
      pendingAction.current = 'resume';
      setPrompt(tracker.issue);
    }
  }, [tracker.issue, toast]);

  // Deep-link ?room= -> join once automatically.
  const roomParam = params.get('room');
  const autoJoined = useRef(false);
  useEffect(() => {
    if (mode === 'group' && roomParam && !group.room && !autoJoined.current) {
      autoJoined.current = true;
      group.join(roomParam);
    }
  }, [mode, roomParam, group]);

  const canStart = mode === 'solo' || group.isLive;

  // Misi sejenis (lari/sepeda sama) yang belum selesai: Bomb Mission dulu karena ada penalti, lalu circle mission.
  const suggestions = useMemo<SuggestedMission[]>(
    () =>
      [
        ...openBombs
          .filter((b) => b.type === circleType)
          .map((b) => ({
            id: b.id,
            title: `Bomb from @${b.counterpart.username}`,
            targetKm: b.targetKm,
            rewardRankPoints: b.rewardRankPoints,
            kind: 'bomb' as const,
          })),
        ...openGroup
          .filter((g) => g.type === circleType)
          .map((g) => ({ id: g.id, title: g.title, targetKm: g.targetKm, kind: 'circle' as const })),
      ].slice(0, MAX_SUGGESTIONS),
    [openBombs, openGroup, circleType],
  );
  const isFreePlan = planId === FREE_RUN || planId === FREE_RIDE;

  function startNow() {
    // iOS: izin kompas harus diminta langsung dari gestur tap, sebelum await apa pun.
    void requestCompassPermission();
    if (simulate) startTracking(true, undefined, activityType);
    else void withLocation('start');
  }

  function handleStart() {
    if (isFreePlan && suggestions.length > 0 && !suggestSkipped()) {
      setSuggestOpen(true);
      return;
    }
    startNow();
  }

  function pickSuggestion(id: string) {
    setSuggestOpen(false);
    selectPlan(id);
    startNow(); // jenis aktivitas misi sama dengan free run/ride yang dipilih, jadi tipe rekaman tidak berubah
  }

  function skipSuggestion() {
    try {
      sessionStorage.setItem(SKIP_SUGGEST_KEY, '1');
    } catch {
      /* private mode: akan ditanya lagi, tidak fatal */
    }
    setSuggestOpen(false);
    startNow();
  }

  function handleResume() {
    if (tracker.simulated) tracker.resume();
    else void withLocation('resume');
  }

  function requestStop() {
    if (status === 'running') tracker.pause();
    setConfirmFinish(true);
  }

  async function confirmStop() {
    setConfirmFinish(false);
    // Rekaman berhenti → layar peta penuh menutup. Hasil akhir dibaca langsung dari tracker.
    const snap = tracker.stop();
    const startedAt = snap.startedAt ?? Date.now();
    setFinishing(true);
    try {
      // Reverse geocoding SEKALI per aktivitas, hanya di sini (Finish) dan hanya bila aktivitas layak dihitung.
      const locationLabel =
        snap.distanceKm >= MIN_GEOCODE_KM
          ? await resolveActivityLabel(snap.points, snap.type, startedAt)
          : fallbackLabel(snap.type, startedAt);
      setResult(
        recordActivity({
          missionId: mission?.id ?? null,
          mode,
          type: snap.type,
          distanceKm: snap.distanceKm,
          durationSec: snap.elapsedSec,
          route: snap.points,
          speedViolation: detectSpeedViolation(snap.points, snap.type),
          sessionId: snap.sessionId,
          startedAt,
          elevationGain: snap.elevationGain,
          locationLabel,
        }),
      );
    } finally {
      setFinishing(false);
    }
  }

  function discardWorkout() {
    setConfirmFinish(false);
    tracker.reset({ discard: true });
    toast('Workout discarded', 'info');
  }

  function closeResult(to?: string) {
    setResult(null);
    tracker.reset();
    patchParams({ mission: null });
    if (to) navigate(to);
  }

  const liveAcc = accuracyMeters ?? (here?.accuracy ? Math.round(here.accuracy) : null);
  const friends = useMemo(
    () => live.members.map((m) => ({ id: m.userId, name: m.username, lat: m.lat, lng: m.lng, heading: m.heading })),
    [live.members],
  );

  const statusText = locating
    ? 'Locking high-accuracy GPS…'
    : !canStart
      ? 'Waiting for the session to go LIVE'
      : here
          ? liveAcc !== null
            ? `GPS ready (±${liveAcc}m)`
            : 'GPS ready'
          : 'Location needed to start';

  const planSubtitle = mission
    ? `Goal ${mission.targetKm} km · ${activityType === 'run' ? 'Run' : 'Ride'}`
    : mode === 'group'
      ? 'Live with your circle'
      : 'Solo · no goal';

  if (!activeCircle && !tracking) {
    return <CircleRequiredGate feature="activity" />;
  }

  return (
    <div className="space-y-4">
      {/* Peta ringkas: layar penuh baru muncul setelah Start */}
      <div className="relative isolate h-[46dvh] min-h-[280px] overflow-hidden rounded-3xl bg-inset shadow-card">
        <Suspense fallback={null}>
          <RouteMap points={[]} here={here} mode="preview" />
        </Suspense>
        <span
          className="absolute left-3 top-3 z-[5] flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[11px] font-semibold text-muted shadow-sm"
          aria-live="polite"
        >
          {locating && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
          {statusText}
        </span>
      </div>

      {/* Satu baris rencana: tap untuk mengubah (jenis, grup, atau misi) */}
      <button type="button" onClick={() => setPlanOpen(true)} className="block w-full text-left" aria-haspopup="dialog">
        <Card className="flex items-center gap-3 p-3.5 transition active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name={plan.icon} size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{plan.label}</span>
            <span className="block truncate text-xs text-subtle">{planSubtitle}</span>
          </span>
          <span className="flex items-center gap-0.5 text-xs font-semibold text-cidash-primary">
            Change <Icon name="chevronRight" size={14} />
          </span>
        </Card>
      </button>

      {mode === 'group' &&
        (activeCircle ? (
          <GroupRunPanel circleId={activeCircle.id} myId={user.id} group={group} tracking={tracking} />
        ) : (
          <Card className="text-center text-sm text-muted">Join a circle first to start a group run.</Card>
        ))}

      {/* Satu aksi utama, tetap terlihat di bawah layar saat scroll */}
      <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-10">
        <Button fullWidth size="lg" disabled={!canStart || locating || tracking} onClick={handleStart} className="shadow-lg">
          <Icon name={locating ? 'locate' : 'play'} size={18} className={locating ? 'animate-spin' : ''} />
          {locating ? 'Finding you…' : 'Start'}
        </Button>
      </div>

      {tracking && (
        <RecordingScreen
          status={status as 'running' | 'paused'}
          type={activityType}
          points={points}
          distanceKm={tracker.distanceKm}
          elapsedSec={tracker.elapsedSec}
          elevationGain={tracker.elevationGain}
          accuracyMeters={liveAcc}
          simulated={tracker.simulated}
          syncState={tracker.syncState}
          unsynced={tracker.unsynced}
          goalKm={mission?.targetKm}
          gapMessage={group.room ? group.gapMessage : null}
          friends={friends}
          resuming={locating}
          onPause={tracker.pause}
          onResume={handleResume}
          onFinish={requestStop}
        />
      )}

      {suggestOpen && (
        <MissionSuggestModal
          type={circleType}
          missions={suggestions}
          onPick={pickSuggestion}
          onSkip={skipSuggestion}
          onClose={() => setSuggestOpen(false)}
        />
      )}

      {planOpen && (
        <PlanSheet value={planId} options={planOptions} onSelect={selectPlan} onClose={() => setPlanOpen(false)} />
      )}

      {confirmFinish && (
        <Modal title="Finish workout?" onClose={() => setConfirmFinish(false)}>
          {(close) => (
            <div className="space-y-4 text-center">
              <p className="text-sm text-muted">
                You've recorded <b>{tracker.distanceKm.toFixed(2)} km</b> in <b>{formatDuration(tracker.elapsedSec)}</b>.
                {tracker.distanceKm < 0.05 && (
                  <span className="mt-1 block text-xs font-semibold text-warning">
                    Note: Activities under 50 meters are too short to earn Rank Points.
                  </span>
                )}
              </p>
              <div className="space-y-2">
                <Button fullWidth onClick={() => close(() => void confirmStop())}>
                  <Icon name="check" size={16} /> Finish & verify
                </Button>
                <Button
                  variant="secondary"
                  fullWidth
                  onClick={() =>
                    close(() => {
                      setConfirmFinish(false);
                      handleResume();
                    })
                  }
                >
                  <Icon name="play" size={16} /> Keep going
                </Button>
                <Button
                  variant="ghost"
                  fullWidth
                  className="!text-danger hover:!bg-danger/10"
                  onClick={() => close(discardWorkout)}
                >
                  Discard workout
                </Button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {finishing && (
        <div
          className="fixed inset-0 z-[1000] flex flex-col items-center justify-center gap-3 bg-canvas/90 backdrop-blur-sm"
          role="status"
          aria-live="polite"
        >
          <RunnerLoader />
          <p className="text-sm font-semibold text-muted">Saving your workout…</p>
        </div>
      )}

      {prompt && (
        <LocationPrompt
          issue={prompt}
          busy={locating}
          onRetry={() => void withLocation(pendingAction.current)}
          onSimulate={
            devMode
              ? () => {
                  setPrompt(null);
                  setForceSim(true);
                  if (status === 'idle' && pendingAction.current === 'start') startTracking(true, undefined, activityType);
                }
              : undefined
          }
          onClose={() => setPrompt(null)}
        />
      )}

      {result && (
        <VerificationModal
          result={result}
          onRetry={() => closeResult()}
          onDone={() => closeResult(ROUTES.dashboard)}
          onShare={() => {
            setShareLog(result.log ?? null);
            closeResult();
          }}
        />
      )}

      {shareLog && (
        <Suspense fallback={null}>
          <ShareCardModal log={shareLog} username={user.username} onClose={() => setShareLog(null)} />
        </Suspense>
      )}
    </div>
  );
}
