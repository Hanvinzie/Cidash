import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Badge from '../ui/Badge';
import Button from '../ui/Button';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import Picker, { InitialAvatar } from '../ui/Picker';
import { useProtection } from './useProtection';
import { useApp } from '../../store/AppContext';
import { profileTopUp } from '../../routes';
import {
  DEADLINE_OPTIONS_DAYS,
  DIFFICULTIES,
  DIFFICULTY_LABEL,
  DISTANCE_OPTIONS_KM,
  STAKES_LABEL,
  formatMinutes,
  priceQuest,
  type Difficulty,
} from '../../lib/questPricing';
import type { ActivityType } from '../../types';

type Step = 'who' | 'what' | 'stakes';
const ORDER: Step[] = ['who', 'what', 'stakes'];

const TITLES: Record<Step, string> = {
  who: 'Who are you challenging?',
  what: "What's the challenge?",
  stakes: 'Deadline & stakes',
};

const TIER_STYLE = {
  LOW: 'bg-success/10 text-success',
  MEDIUM: 'bg-warning/10 text-warning',
  HIGH: 'bg-danger/10 text-danger',
} as const;

const dayLabel = (d: number) => `${d} ${d === 1 ? 'day' : 'days'}`;

/**
 * Wizard 3 langkah, satu keputusan per layar: Siapa → Tantangan (jenis, jarak, kesulitan) → Tenggat & taruhan.
 * Pengguna hanya memilih jarak resmi dan tingkat kesulitan; batas waktu yang masuk akal, koin, dan taruhan RP
 * dihitung otomatis (dan dihitung ulang oleh server).
 */
export default function SendBombModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { user, activeCircle, members, sendBomb } = useApp();
  const { myStatus } = useProtection();
  const navigate = useNavigate();

  // Tipe Bomb Mission selalu mengikuti tipe Circle aktif (lari / sepeda).
  const type: ActivityType = activeCircle?.activityType ?? 'run';
  const distances = DISTANCE_OPTIONS_KM[type];
  const [step, setStep] = useState<Step>('who');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [distanceKm, setDistanceKm] = useState(() => distances[Math.min(2, distances.length - 1)]);
  const [difficulty, setDifficulty] = useState<Difficulty>('MEDIUM');
  const [deadlineDays, setDeadlineDays] = useState(3);

  const target = members.find((m) => m.id === targetId);
  const resting = myStatus === 'RESTING';
  const idx = ORDER.indexOf(step);

  const effectiveDistance = distances.includes(distanceKm) ? distanceKm : distances[Math.min(2, distances.length - 1)];

  const price = useMemo(
    () => priceQuest({ type, distanceKm: effectiveDistance, difficulty, deadlineDays }),
    [type, effectiveDistance, difficulty, deadlineDays],
  );
  const canAfford = user.coins >= price.coins;

  const unavailableReason = (s?: string) =>
    s === 'RESTING' ? 'Resting (24h immunity)' : s === 'IN_MISSION' ? 'Busy with another mission' : null;

  function send(close: (after?: () => void) => void) {
    if (!target || !canAfford || resting) return;
    sendBomb({ targetUserId: target.id, type, targetKm: effectiveDistance, difficulty, deadlineDays });
    close(() => {
      onClose();
      onSent();
    });
  }

  return (
    <Modal title="Send a Bomb Mission" onClose={onClose} showTitle={false}>
      {(close) => (
        <div>
          <div className="-mt-1 mb-4 flex items-center gap-1">
            {idx > 0 ? (
              <button
                type="button"
                onClick={() => setStep(ORDER[idx - 1])}
                aria-label="Back"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-90 active:bg-inset"
              >
                <Icon name="chevronLeft" size={20} />
              </button>
            ) : (
              <span className="h-10 w-10" />
            )}
            <div>
              <h3 className="text-lg font-bold">{TITLES[step]}</h3>
              <p className="text-xs text-subtle">
                Step {idx + 1} of {ORDER.length}
              </p>
            </div>
          </div>

          {step === 'who' &&
            (members.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted">There are no other members in this circle yet.</p>
            ) : (
              <ul className="max-h-[52dvh] space-y-2 overflow-y-auto pb-1">
                {members.map((m) => {
                  const reason = unavailableReason(m.availabilityStatus);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        disabled={Boolean(reason)}
                        onClick={() => {
                          setTargetId(m.id);
                          setStep('what');
                        }}
                        className="flex w-full items-center gap-3 rounded-2xl bg-inset p-3 text-left transition active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100"
                      >
                        <InitialAvatar text={m.username} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold">@{m.username}</span>
                          <span className="block truncate text-xs text-subtle">{reason ?? 'Ready to receive a Bomb Mission'}</span>
                        </span>
                        {!reason && <Icon name="chevronRight" size={16} className="text-subtle" />}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ))}

          {step === 'what' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl bg-inset px-4 py-3 text-sm">
                <span className="text-muted">Activity type</span>
                <Badge tone="primary">{type === 'run' ? 'Running' : 'Cycling'} · Circle</Badge>
              </div>
              <Picker
                label="Distance"
                sheetTitle="Choose a distance"
                value={String(effectiveDistance)}
                onChange={(v) => setDistanceKm(Number(v))}
                options={distances.map((d) => ({ value: String(d), label: `${d} km` }))}
              />
              <Picker
                label="Difficulty"
                sheetTitle="How hard should it be?"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTIES.map((d) => {
                  const p = priceQuest({ type, distanceKm: effectiveDistance, difficulty: d, deadlineDays });
                  return {
                    value: d,
                    label: DIFFICULTY_LABEL[d],
                    description: `${formatMinutes(p.timeLimitMin)} to finish · about ${p.coins} coins`,
                  };
                })}
              />
              <p className="rounded-2xl bg-inset px-4 py-3 text-sm">
                {type === 'run' ? 'Run' : 'Ride'} <b>{effectiveDistance} km</b> within <b>{formatMinutes(price.timeLimitMin)}</b>{' '}
                <span className="text-subtle">({price.maxPace.toFixed(2)} min/km)</span>
              </p>
              <Button fullWidth onClick={() => setStep('stakes')}>
                Next
              </Button>
            </div>
          )}

          {step === 'stakes' && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-inset px-4 py-3 text-sm">
                <b>@{target?.username}</b> must {type === 'run' ? 'run' : 'ride'} <b>{effectiveDistance} km</b> in{' '}
                <b>{formatMinutes(price.timeLimitMin)}</b> ({DIFFICULTY_LABEL[difficulty]}).
              </p>

              <Picker
                label="Deadline"
                sheetTitle="Deadline (1 to 7 days)"
                value={String(deadlineDays)}
                onChange={(v) => setDeadlineDays(Number(v))}
                options={DEADLINE_OPTIONS_DAYS.map((d) => ({
                  value: String(d),
                  label: dayLabel(d),
                  description:
                    d === 1 ? 'Most expensive' : d === DEADLINE_OPTIONS_DAYS[DEADLINE_OPTIONS_DAYS.length - 1] ? 'Cheapest' : undefined,
                }))}
              />
              <p className="-mt-2 px-1 text-[11px] text-subtle">A shorter deadline costs more coins.</p>

              <div className="space-y-2 rounded-2xl bg-inset p-3.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Cost</span>
                  <span className="flex items-center gap-1 text-lg font-extrabold">
                    <Icon name="coin" size={16} className="text-warning" /> {price.coins}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Stakes</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${TIER_STYLE[price.stakesTier]}`}>
                    {STAKES_LABEL[price.stakesTier]} · ±{price.stakesPoints} RP
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1 text-center text-xs font-semibold">
                  <span className="rounded-lg bg-success/10 py-1.5 text-success">Win: +{price.stakesPoints} RP</span>
                  <span className="rounded-lg bg-danger/10 py-1.5 text-danger">Fail: −{price.stakesPoints} RP</span>
                </div>
                <p className="text-center text-[11px] text-subtle">Your balance: {user.coins} coins</p>
              </div>

              {!canAfford && (
                <p className="rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
                  You need {price.coins - user.coins} more coins.{' '}
                  <button
                    type="button"
                    onClick={() =>
                      close(() => {
                        onClose();
                        navigate(profileTopUp);
                      })
                    }
                    className="font-bold underline"
                  >
                    Top up
                  </button>{' '}
                  or pick an easier difficulty or a longer deadline.
                </p>
              )}

              {resting && (
                <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                  You're in Rest Mode. Switch to Ready (Protection) before sending.
                </p>
              )}

              <Button fullWidth disabled={!canAfford || resting} onClick={() => send(close)}>
                Send challenge · {price.coins} coins
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
