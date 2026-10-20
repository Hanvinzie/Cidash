import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ScreenHeader from '../components/ui/ScreenHeader';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Icon from '../components/ui/Icon';
import { Segmented, Select } from '../components/ui/Field';
import GroupRunPanel from '../components/activity/GroupRunPanel';
import VerificationModal from '../components/activity/VerificationModal';
import ShareCardModal from '../components/share/ShareCardModal';
import { useApp } from '../store/AppContext';
import { useGeoTracker } from '../hooks/useGeoTracker';
import { useGroupRun } from '../hooks/useGroupRun';
import { detectSpeedViolation, estimateCalories, formatDuration, formatPace } from '../lib/geo';
import { ROUTES } from '../routes';
import type { ActivityLog, ActivityType, RunMode, VerificationResult } from '../types';

// Leaflet (~45 KB gzip) hanya dimuat saat halaman Activity dibuka.
const RouteMap = lazy(() => import('../components/map/RouteMap'));

const GENERAL = 'general';

export default function Activity() {
  const { user, activeCircle, groupMissions, bombMissions, recordActivity } = useApp();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tracker = useGeoTracker();
  const { status, distanceKm, elapsedSec, points } = tracker;
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
  const mode: RunMode = params.get('mode') === 'group' ? 'group' : 'solo';

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

  // ---- Group Run (progress sent automatically every 5 s while tracking) ----
  const group = useGroupRun({
    me: { id: user.id, username: user.username },
    reporting: mode === 'group' && status === 'running',
    distanceKm,
    lastPoint: points[points.length - 1],
  });

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

  const statusText =
    status === 'running'
      ? tracker.simulated
        ? 'Simulation mode'
        : 'GPS on — recording route'
      : status === 'paused'
        ? 'Paused'
        : !canStart
          ? 'Join a room and wait for the session to go LIVE.'
          : 'Ready when you are';

  return (
    <div className="space-y-5">
      <ScreenHeader title="Activity" />

      <Segmented
        ariaLabel="Activity mode"
        value={mode}
        onChange={(m) => !tracking && patchParams({ mode: m === 'group' ? 'group' : null, room: null })}
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
          <p className="flex items-center gap-1.5 rounded-xl bg-cidash-primary/10 px-3 py-2 text-xs text-ink">
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
        <div className="relative isolate h-56">
          <Suspense fallback={<div className="flex h-full items-center justify-center bg-inset text-xs text-subtle">Loading map…</div>}>
            <RouteMap points={points} />
          </Suspense>
          <span
            className={`absolute left-3 top-3 z-[500] flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold shadow ${
              status === 'running' ? 'bg-cidash-primary text-cidash-on-primary' : 'bg-surface/90 text-muted'
            }`}
            aria-live="polite"
          >
            {status === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />}
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

        {tracker.error && (
          <p role="alert" className="m-3 rounded-xl bg-danger/10 p-2 text-center text-xs font-medium text-danger">
            {tracker.error}
          </p>
        )}
      </Card>

      {status === 'idle' && (
        <label className="flex items-center justify-center gap-2 text-xs text-muted">
          <input
            type="checkbox"
            checked={simulate}
            onChange={(e) => setSimulate(e.target.checked)}
            className="h-4 w-4 accent-cidash-primary"
          />
          Simulation mode (test without GPS)
        </label>
      )}

      {/* Controls stay reachable above the bottom navigation */}
      <div className="sticky bottom-[calc(5rem+env(safe-area-inset-bottom))] z-10 flex gap-3">
        {status === 'idle' && (
          <Button fullWidth size="lg" disabled={!canStart} onClick={() => tracker.start(simulate)} className="shadow-lg">
            <Icon name="play" size={18} /> Start
          </Button>
        )}
        {status === 'running' && (
          <Button fullWidth size="lg" variant="secondary" onClick={tracker.pause} className="shadow-lg">
            <Icon name="pause" size={18} /> Pause
          </Button>
        )}
        {status === 'paused' && (
          <Button fullWidth size="lg" onClick={tracker.resume} className="shadow-lg">
            <Icon name="play" size={18} /> Resume
          </Button>
        )}
        {tracking && (
          <Button fullWidth size="lg" variant="danger" onClick={handleStop} className="bg-surface shadow-lg">
            <Icon name="stop" size={18} /> Finish
          </Button>
        )}
      </div>

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

      {shareLog && <ShareCardModal log={shareLog} username={user.username} onClose={() => setShareLog(null)} />}
    </div>
  );
}
