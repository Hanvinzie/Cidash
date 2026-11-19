import { useState } from 'react';
import Button from '../ui/Button';
import { StatusBadge } from '../ui/Badge';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import RouteSvg from '../share/RouteSvg';
import { estimateCalories, formatDuration, formatPace } from '../../lib/geo';
import type { ActivityLog } from '../../types';

interface HistoryModalProps {
  logs: ActivityLog[];
  onClose: () => void;
  onShare: (log: ActivityLog) => void;
}

const typeLabel = (a: ActivityLog) => (a.type === 'run' ? 'Run' : 'Ride');
const title = (a: ActivityLog) => (a.routeLabel && a.routeLabel !== 'Recorded workout' ? a.routeLabel : typeLabel(a));
/** Jenis aktivitas hanya ditulis di subjudul bila judulnya belum menyebutnya (hindari "Ride · Ride"). */
const subtitle = (a: ActivityLog) => `${title(a) === typeLabel(a) ? '' : `${typeLabel(a)} · `}${a.distanceKm} km · ${formatDuration(a.durationSec)}`;

/**
 * Riwayat aktivitas dalam modal: daftar bisa di-scroll DI DALAM modal (tidak memanjangkan halaman Profile).
 * Ketuk satu aktivitas untuk melihat detailnya dan membagikannya.
 */
export default function HistoryModal({ logs, onClose, onShare }: HistoryModalProps) {
  const [selected, setSelected] = useState<ActivityLog | null>(null);
  const totalKm = logs.reduce((sum, a) => sum + a.distanceKm, 0);

  return (
    <Modal title={selected ? title(selected) : 'Activity history'} onClose={onClose} showTitle={!selected}>
      {() =>
        selected ? (
          <Detail log={selected} onBack={() => setSelected(null)} onShare={() => onShare(selected)} />
        ) : logs.length === 0 ? (
          <p className="py-10 text-center text-sm text-subtle">No recorded workouts yet.</p>
        ) : (
          <div>
            <p className="-mt-2 mb-3 text-center text-xs text-subtle">
              {logs.length} {logs.length === 1 ? 'activity' : 'activities'} · {totalKm.toFixed(1)} km total
            </p>
            <ul className="max-h-[58dvh] space-y-2 overflow-y-auto pb-1" aria-label="Activities">
              {logs.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(a)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-inset p-3 text-left transition active:scale-[0.98]"
                  >
                    <RouteSvg
                      points={a.route}
                      width={64}
                      height={64}
                      strokeWidth={3}
                      padding={6}
                      className="h-14 w-14 shrink-0 rounded-xl bg-cidash-primary/5 text-subtle"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-bold">{title(a)}</span>
                      <span className="block truncate text-xs text-subtle">
                        {subtitle(a)}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">{a.date}</span>
                    </span>
                    <Icon name="chevronRight" size={16} className="text-subtle" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )
      }
    </Modal>
  );
}

function Detail({ log, onBack, onShare }: { log: ActivityLog; onBack: () => void; onShare: () => void }) {
  const stats = [
    { label: 'Distance', value: `${log.distanceKm} km` },
    { label: 'Time', value: formatDuration(log.durationSec) },
    { label: 'Pace', value: `${formatPace(log.durationSec, log.distanceKm)} /km` },
    log.elevationGain ? { label: 'Elevation', value: `${Math.round(log.elevationGain)} m` } : { label: 'Calories', value: `${estimateCalories(log.distanceKm, log.type)} kcal` },
  ];
  return (
    <div className="space-y-4">
      <div className="-mt-1 flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to history"
          className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-90 active:bg-inset"
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <div className="min-w-0">
          <h3 className="truncate text-lg font-bold">{title(log)}</h3>
          <p className="text-xs text-subtle">
            {log.date} · {log.type === 'run' ? 'Run' : 'Ride'}
          </p>
        </div>
        <span className="ml-auto">
          <StatusBadge status={log.missionStatus} />
        </span>
      </div>

      <RouteSvg
        points={log.route}
        width={340}
        height={180}
        strokeWidth={4}
        padding={16}
        className="h-44 w-full rounded-2xl bg-cidash-primary/5 text-subtle"
      />

      <dl className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl bg-inset px-4 py-3">
            <dd className="text-xl font-extrabold tabular-nums">{s.value}</dd>
            <dt className="text-[11px] font-medium text-subtle">{s.label}</dt>
          </div>
        ))}
      </dl>

      <Button fullWidth onClick={onShare}>
        <Icon name="share" size={16} /> Share
      </Button>
    </div>
  );
}
