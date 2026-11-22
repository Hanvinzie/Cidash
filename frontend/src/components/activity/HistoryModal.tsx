import { useState } from 'react';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import RouteSvg from '../share/RouteSvg';
import { caloriesFor } from '../../lib/calories';
import { formatDuration, formatPace } from '../../lib/geo';
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
                      <span className="line-clamp-2 block font-bold leading-snug [overflow-wrap:anywhere]">{title(a)}</span>
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
    { label: 'Distance', value: `${log.distanceKm}`, unit: 'km' },
    { label: 'Time', value: formatDuration(log.durationSec), unit: '' },
    { label: 'Pace', value: formatPace(log.durationSec, log.distanceKm), unit: '/km' },
    { label: 'Elevation', value: `${Math.round(log.elevationGain ?? 0)}`, unit: 'm' },
    { label: 'Calories', value: `${caloriesFor(log.distanceKm, log.type, log.durationSec)}`, unit: 'kcal' },
  ];
  return (
    <div className="space-y-5">
      {/* Baris atas: tombol kembali + jenis & tanggal. Judul panjang ada di bawahnya agar tidak berdesakan dengan tombol. */}
      <div className="-mt-1 flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to history"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted transition active:scale-90 active:bg-inset"
        >
          <Icon name="chevronLeft" size={20} />
        </button>
        <p className="min-w-0 truncate text-xs font-semibold text-subtle">
          {log.type === 'run' ? 'Run' : 'Ride'} · {log.date}
        </p>
      </div>

      <h3 className="px-1 text-xl font-extrabold leading-snug [overflow-wrap:anywhere] line-clamp-3">{title(log)}</h3>

      <RouteSvg
        points={log.route}
        width={340}
        height={180}
        strokeWidth={4}
        padding={16}
        className="h-44 w-full rounded-2xl bg-cidash-primary/5 text-subtle"
      />

      <dl className="grid grid-cols-6 gap-2.5">
        {stats.map((s, i) => (
          <div
            key={s.label}
            // 3 kartu di baris atas, 2 kartu lebar di baris bawah: angka panjang (mis. 1:02:45) tetap muat.
            className={`rounded-2xl bg-inset px-3 py-3 ${i < 3 ? 'col-span-2' : 'col-span-3'}`}
          >
            <dd className="flex items-baseline gap-1 text-lg font-extrabold tabular-nums leading-tight">
              <span className="min-w-0 truncate">{s.value}</span>
              {s.unit && <span className="text-[11px] font-semibold text-subtle">{s.unit}</span>}
            </dd>
            <dt className="mt-0.5 text-[11px] font-medium text-subtle">{s.label}</dt>
          </div>
        ))}
      </dl>

      <Button fullWidth onClick={onShare}>
        <Icon name="share" size={16} /> Share
      </Button>
    </div>
  );
}
