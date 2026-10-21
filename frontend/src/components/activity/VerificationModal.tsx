import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import { estimateCalories, formatDuration, formatPace } from '../../lib/geo';
import type { VerificationResult } from '../../types';

interface VerificationModalProps {
  result: VerificationResult;
  onRetry: () => void;
  onDone: () => void;
  onShare: () => void;
}

const MISSION_TEXT = {
  completed: 'Mission complete',
  failed: 'Mission missed',
  in_progress: 'Mission progress saved',
  pending: '',
};

export default function VerificationModal({ result, onRetry, onDone, onShare }: VerificationModalProps) {
  const { valid, distanceKm, durationSec, rankPointsDelta, missionStatus, log } = result;

  if (!valid) {
    return (
      <Modal title="Couldn't verify this activity" onClose={onRetry}>
        {(close) => (
          <div className="text-center">
            <span className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-danger/15 text-danger">
              <Icon name="close" size={26} />
            </span>
            <p className="mb-5 text-sm text-muted">{result.reason}</p>
            <Button fullWidth onClick={() => close(onRetry)}>
              Try again
            </Button>
          </div>
        )}
      </Modal>
    );
  }

  const stats = [
    { label: 'Pace /km', value: formatPace(durationSec, distanceKm) },
    { label: 'Time', value: formatDuration(durationSec) },
    {
      label: 'kcal',
      value: log ? estimateCalories(distanceKm, log.type) : '—',
    },
  ];

  return (
    <Modal title="Nice work!" onClose={onDone}>
      {(close) => (
        <div className="text-center">
          <p className="animate-rise text-5xl font-extrabold tracking-tight tabular-nums">
            {distanceKm.toFixed(2)}
            <span className="ml-1 text-lg font-bold text-subtle">km</span>
          </p>

          <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl bg-inset py-3">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col-reverse">
                <dt className="text-[11px] text-subtle">{s.label}</dt>
                <dd className="font-bold tabular-nums">{s.value}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-3 flex items-center justify-center gap-2 text-sm font-semibold">
            <span className={rankPointsDelta >= 0 ? 'text-success' : 'text-danger'}>
              {rankPointsDelta >= 0 ? '+' : ''}
              {rankPointsDelta} RP
            </span>
            {missionStatus && MISSION_TEXT[missionStatus] && (
              <>
                <span className="text-subtle">·</span>
                <span className="text-muted">{MISSION_TEXT[missionStatus]}</span>
              </>
            )}
          </div>
          <p className="mt-1 flex items-center justify-center gap-1 text-[11px] text-subtle">
            <Icon name="check" size={12} className="text-success" /> GPS route verified
          </p>

          <div className="mt-5 space-y-2">
            {log && (
              <Button fullWidth onClick={() => close(onShare)}>
                <Icon name="share" size={16} /> Share card
              </Button>
            )}
            <Button variant="ghost" fullWidth onClick={() => close(onDone)}>
              Done
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
