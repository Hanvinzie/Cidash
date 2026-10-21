import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Segmented, Select } from '../components/ui/Field';
import GroupRunPanel from '../components/activity/GroupRunPanel';
import LocationPrompt from '../components/activity/LocationPrompt';
import VerificationModal from '../components/activity/VerificationModal';
import { RouteMap, ShareCardModal } from '../lazyScreens';
import { useApp } from '../store/AppContext';
import { useRunSession } from '../store/RunSession';
import { useToast } from '../store/ToastContext';
import { detectSpeedViolation, estimateCalories, formatDuration, formatPace } from '../lib/geo';
import { LocationError, queryPermission, requestPosition, watchPermission, type LocationIssue } from '../lib/location';
import { ROUTES } from '../routes';
import type { ActivityLog, ActivityType, RunMode, VerificationResult } from '../types';

const GENERAL = 'general';
const WEAK_SIGNAL = "Couldn't find your location. Make sure GPS is on and you're in an open area.";

type BlockingIssue = Exclude<LocationIssue, 'timeout'>;

export default function Activity() {
  const { user, activeCircle, groupMissions, bombMissions, recordActivity } = useApp();
  const { tracker, group } = useRunSession();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { status, distanceKm, elapsedSec, points, start: startTracking, resume: resumeTracking } = tracker;
  const tracking = status === 'running' || status === 'paused';

  /** Patch some query params (?mode, ?mission, ?room) without dropping the others. */
  const patchParams = (patch: Record<string, string | null>) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        Object.entries(patch).forEach(([k, v]) => (v === null ? next.delete(k) : next.set(k, v)));
        return next;
      },
      { replace: true },
    );

  // ---- Mode (Solo / Group) — stored in the URL for deep-linking ----
  const mode: RunMode = params.get('mode') === 'group' || group.room ? 'group' : 'solo';

  // ---- Mission selection ----
  const openGroup = groupMissions.filter((m) => m.status !== 'completed');
  const openBombs = bombMissions.filter((b) => b.direction === 'incoming' && b.status === 'in_progress');
  const requested = params.get('mission');
  const missionId = requested && [...openGroup, ...openBombs].some((m) => m.id === requested) ? requested : GENERAL;
  const mission = openBombs.find((b) => b.id === missionId) ?? openGroup.find((g) => g.id === missionId);

  const [freeType, setFreeType] = useState<ActivityType>('run');
  const activityType = mission?.type ?? freeType;
  const [simulate, setSimulate] = useState(false);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [shareLog, setShareLog] = useState<ActivityLog | null>(null);

  // ---- Location pre-run check ----
  const [here, setHere] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [prompt, setPrompt] = useState<BlockingIssue | null>(null);
  const pendingAction = useRef<'start' | 'resume'>('start');

  // Saat halaman dibuka: kalau izin sudah ada, ambil posisi diam-diam untuk memusatkan peta.
  useEffect(() => {
    let alive = true;
    void queryPermission().then((state) => {
      if (state === 'granted' && alive) {
        requestPosition(10_000)
          .then((p) => alive && setHere({ lat: p.coords.latitude, lng: p.coords.longitude }))
          .catch(() => {});
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  /** Pastikan izin + GPS aktif, lalu jalankan aksi. Gagal → panduan (modal) atau toast. */
  const withLocation = useCallback(
    async (action: 'start' | 'resume') => {
      pendingAction.current = action;
      setLocating(true);
      try {
        const pos = await requestPosition(8_000);
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp };
        setHere(point);
        setPrompt(null);
        if (action === 'start') startTracking(false, point);
        else resumeTracking();
      } catch (e) {
        const issue = e instanceof LocationError ? e.issue : 'unavailable';
        if (issue === 'timeout') toast(WEAK_SIGNAL, 'error');
        else setPrompt(issue);
      } finally {
        setLocating(false);
      }
    },
    [startTracking, resumeTracking, toast],
  );

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

  function handleStart() {
    if (simulate) tracker.start(true);
    else void withLocation('start');
  }

  function handleResume() {
    if (tracker.simulated) tracker.resume();
    else void withLocation('resume');
  }

  function handleStop() {
    tracker.stop();
    setResult(
      recordActivity({
        missionId: mission?.id ?? null,
        mode,
        type: activityType,
        distanceKm,
        durationSec: elapsedSec,
        route: points,
        speedViolation: detectSpeedViolation(points, activityType),
      }),
    );
  }

  function closeResult(to?: string) {
    setResult(null);
    tracker.reset();
    patchParams({ mission: null });
    if (to) navigate(to);
  }

  const statusText = locating
    ? 'Finding your location…'
    : status === 'running'
      ? tracker.simulated
        ? 'Simulation'
        : 'Recording'
      : status === 'paused'
        ? 'Paused'
        : !canStart
          ? 'Waiting for the session to go LIVE'
          : here
            ? 'GPS ready'
            : simulate
              ? 'Simulation'
              : 'Location needed to start';

  return (
    <div className="space-y-5">
      <ScreenHeader title="Activity" />

      <Segmented
        ariaLabel="Activity mode"
        value={mode}
        onChange={(m) => !tracking && !group.room && patchParams({ mode: m === 'group' ? 'group' : null, room: null })}
        options={[
          { value: 'solo', label: <><Icon name="user" size={16} /> Solo / Quest</> },
          { value: 'group', label: <><Icon name="users" size={16} /> Group run</> },
        ]}
      />

      {mode === 'group' &&
        (activeCircle ? (
          <GroupRunPanel circleId={activeCircle.id} myId={user.id} group={group} tracking={tracking} />
        ) : (
          <Card className="text-center text-sm text-muted">Join a circle first to start a group run.</Card>
        ))}

      {/* Mission selection */}
      <Card className="space-y-3">
        <Select
          label="What are you working on?"
          value={missionId}
          disabled={tracking}
          onChange={(e) => patchParams({ mission: e.target.value === GENERAL ? null : e.target.value })}
        >
          <option value={GENERAL}>Free workout</option>
          {openGroup.length > 0 && (
            <optgroup label="Circle missions">
              {openGroup.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title} ({m.progressKm}/{m.targetKm} km)
                </option>
              ))}
            </optgroup>
          )}
          {openBombs.length > 0 && (
            <optgroup label="Bomb Missions">
              {openBombs.map((b) => (
                <option key={b.id} value={b.id}>
                  @{b.counterpart.username} — {b.targetKm} km / {b.durationMin} min
                </option>
              ))}
            </optgroup>
          )}
        </Select>

        {mission ? (
          <p className="flex items-center gap-1.5 rounded-xl bg-inset px-3 py-2 text-xs text-ink">
            <Icon name="target" size={14} className="text-cidash-primary" />
            Goal: <b>{mission.targetKm} km</b>
            {'durationMin' in mission && (
              <>
                {' '}in <b>{mission.durationMin} min</b>
              </>
            )}{' '}
            · {activityType === 'run' ? 'Run' : 'Ride'}
          </p>
        ) : (
          !tracking && (
            <Segmented
              ariaLabel="Activity type"
              value={freeType}
              onChange={setFreeType}
              options={[
                { value: 'run', label: 'Run' },
                { value: 'bike', label: 'Ride' },
              ]}
            />
          )
        )}
      </Card>

      {/* Map + live metrics */}
      <Card className="overflow-hidden p-0">
        <div className="relative isolate h-56 bg-inset">
          <Suspense fallback={null}>
            <RouteMap points={points} here={here} />
          </Suspense>
          <span
            className={`absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow-sm ${
              status === 'running' ? 'bg-cidash-primary text-cidash-on-primary' : 'bg-surface text-muted'
            }`}
            aria-live="polite"
          >
            {(status === 'running' || locating) && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />}
            {statusText}
          </span>
        </div>

        <dl className="grid grid-cols-2 gap-px bg-line/70">
          {[
            { label: 'Distance (km)', value: distanceKm.toFixed(2), big: true },
            { label: 'Duration', value: formatDuration(elapsedSec), big: true },
            { label: 'Pace (min/km)', value: formatPace(elapsedSec, distanceKm) },
            { label: 'Est. calories', value: estimateCalories(distanceKm, activityType) },
          ].map((m) => (
            <div key={m.label} className="flex flex-col-reverse items-center bg-surface py-3">
              <dt className="text-[11px] font-medium text-subtle">{m.label}</dt>
              <dd className={`tabular-nums ${m.big ? 'text-3xl font-extrabold' : 'text-xl font-bold'}`}>{m.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {status === 'idle' && (
        <label className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3 text-sm shadow-card">
          <span>
            <span className="block font-semibold">Simulation mode</span>
            <span className="text-xs text-subtle">Test without GPS</span>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={simulate}
            onChange={(e) => setSimulate(e.target.checked)}
            className="peer sr-only"
          />
          <span
            aria-hidden
            className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-cidash-primary peer-checked:after:translate-x-5"
          />
        </label>
      )}

      {/* Controls: tetap terlihat di bawah layar saat scroll */}
      <div className="sticky bottom-3 z-10 flex gap-3">
        {status === 'idle' && (
          <Button fullWidth size="lg" disabled={!canStart || locating} onClick={handleStart} className="shadow-lg">
            <Icon name={locating ? 'locate' : 'play'} size={18} className={locating ? 'animate-spin' : ''} />
            {locating ? 'Finding you…' : 'Start'}
          </Button>
        )}
        {status === 'running' && (
          <Button fullWidth size="lg" variant="secondary" onClick={tracker.pause} className="shadow-lg">
            <Icon name="pause" size={18} /> Pause
          </Button>
        )}
        {status === 'paused' && (
          <Button fullWidth size="lg" disabled={locating} onClick={handleResume} className="shadow-lg">
            <Icon name="play" size={18} /> {locating ? 'Finding you…' : 'Resume'}
          </Button>
        )}
        {tracking && (
          <Button fullWidth size="lg" variant="danger" onClick={handleStop} className="bg-surface shadow-lg">
            <Icon name="stop" size={18} /> Finish
          </Button>
        )}
      </div>

      {prompt && (
        <LocationPrompt
          issue={prompt}
          busy={locating}
          onRetry={() => void withLocation(pendingAction.current)}
          onSimulate={() => {
            setPrompt(null);
            setSimulate(true);
            if (status === 'idle') tracker.start(true);
          }}
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
