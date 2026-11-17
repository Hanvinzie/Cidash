import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../ui/Button';
import { Input, Segmented } from '../ui/Field';
import Icon from '../ui/Icon';
import Modal from '../ui/Modal';
import { InitialAvatar } from '../ui/Picker';
import { useProtection } from './useProtection';
import { useApp } from '../../store/AppContext';
import { profileTopUp } from '../../routes';
import type { ActivityType } from '../../types';

const MIN_WAGER = 5;
const MAX_WAGER = 100;
const DEADLINE_HOURS = [6, 12, 24, 48] as const;

/** Date -> datetime-local value (zona waktu lokal), format yang dipakai sendBomb. */
function hoursFromNow(h: number) {
  const d = new Date(Date.now() + h * 3_600_000);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

interface Preset {
  id: string;
  label: string;
  type: ActivityType;
  targetKm: number;
  durationMin: number;
}

const PRESETS: Preset[] = [
  { id: 'run3', label: 'Easy 3K', type: 'run', targetKm: 3, durationMin: 25 },
  { id: 'run5', label: '5K Challenge', type: 'run', targetKm: 5, durationMin: 35 },
  { id: 'run10', label: '10K Run', type: 'run', targetKm: 10, durationMin: 70 },
  { id: 'bike10', label: 'Quick Ride 10K', type: 'bike', targetKm: 10, durationMin: 35 },
  { id: 'bike25', label: 'Long Ride 25K', type: 'bike', targetKm: 25, durationMin: 80 },
];

type Step = 'who' | 'what' | 'stakes';
const ORDER: Step[] = ['who', 'what', 'stakes'];

/**
 * Wizard 3 langkah, satu keputusan per layar: Siapa → Tantangan (daftar preset) → Taruhan & tenggat.
 * Default masuk akal di setiap langkah, jadi pengguna bisa menekan Send tanpa mengisi formulir.
 */
export default function SendBombModal({ onClose, onSent }: { onClose: () => void; onSent: () => void }) {
  const { user, members, sendBomb } = useApp();
  const { myStatus } = useProtection();
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>('who');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string>('run5');
  const [custom, setCustom] = useState<Preset>({ id: 'custom', label: 'Custom', type: 'run', targetKm: 3, durationMin: 25 });
  const [deadlineH, setDeadlineH] = useState<(typeof DEADLINE_HOURS)[number]>(24);
  const maxWager = Math.min(user.coins, MAX_WAGER);
  const canWager = maxWager >= MIN_WAGER;
  const [wager, setWager] = useState(Math.max(MIN_WAGER, Math.min(20, maxWager)));
  const effectiveWager = Math.min(wager, maxWager);

  const target = members.find((m) => m.id === targetId);
  const challenge = presetId === 'custom' ? custom : (PRESETS.find((p) => p.id === presetId) ?? PRESETS[1]);
  const resting = myStatus === 'RESTING';

  const unavailableReason = (s?: string) =>
    s === 'RESTING' ? 'Resting (24h immunity)' : s === 'IN_MISSION' ? 'Busy with another mission' : null;

  function send(close: (after?: () => void) => void) {
    if (!target || !canWager || resting) return;
    sendBomb({
      targetUserId: target.id,
      type: challenge.type,
      targetKm: challenge.targetKm,
      durationMin: challenge.durationMin,
      deadline: hoursFromNow(deadlineH),
      wagerCoins: effectiveWager,
    });
    close(() => {
      onClose();
      onSent();
    });
  }

  const idx = ORDER.indexOf(step);

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
              <h3 className="text-lg font-bold">
                {step === 'who' ? 'Who are you challenging?' : step === 'what' ? 'What\'s the challenge?' : 'Stakes & deadline'}
              </h3>
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
            <div className="space-y-2">
              <ul className="max-h-[46dvh] space-y-2 overflow-y-auto pb-1" role="radiogroup" aria-label="Challenge">
                {[...PRESETS, { ...custom, id: 'custom', label: 'Custom…' }].map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={presetId === p.id}
                      onClick={() => setPresetId(p.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition active:scale-[0.98] ${
                        presetId === p.id ? 'border-cidash-primary bg-cidash-primary/5' : 'border-line bg-inset'
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-bold">{p.label}</span>
                        {p.id !== 'custom' && (
                          <span className="block text-xs text-subtle">
                            {p.type === 'run' ? 'Run' : 'Ride'} {p.targetKm} km in {p.durationMin} min
                          </span>
                        )}
                      </span>
                      {presetId === p.id && <Icon name="check" size={18} className="text-cidash-primary" />}
                    </button>
                  </li>
                ))}
              </ul>
              {presetId === 'custom' && (
                <div className="space-y-3 rounded-2xl bg-inset p-3">
                  <Segmented<ActivityType>
                    ariaLabel="Activity type"
                    value={custom.type}
                    onChange={(type) => setCustom({ ...custom, type })}
                    options={[
                      { value: 'run', label: 'Run' },
                      { value: 'bike', label: 'Ride' },
                    ]}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Input
                      label="Distance (km)"
                      type="number"
                      inputMode="decimal"
                      min={0.5}
                      max={100}
                      step={0.5}
                      value={custom.targetKm}
                      onChange={(e) => setCustom({ ...custom, targetKm: Number(e.target.value) })}
                    />
                    <Input
                      label="Time limit (min)"
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={600}
                      value={custom.durationMin}
                      onChange={(e) => setCustom({ ...custom, durationMin: Number(e.target.value) })}
                    />
                  </div>
                </div>
              )}
              <Button
                fullWidth
                disabled={presetId === 'custom' && !(custom.targetKm >= 0.5 && custom.durationMin >= 1)}
                onClick={() => setStep('stakes')}
              >
                Next
              </Button>
            </div>
          )}

          {step === 'stakes' && (
            <div className="space-y-4">
              <p className="rounded-2xl bg-inset px-4 py-3 text-sm">
                <b>@{target?.username}</b> must {challenge.type === 'run' ? 'run' : 'ride'} <b>{challenge.targetKm} km</b> in{' '}
                <b>{challenge.durationMin} min</b>.
              </p>

              <div>
                <p className="mb-1.5 text-xs font-semibold text-muted">Deadline</p>
                <Segmented
                  ariaLabel="Deadline"
                  value={String(deadlineH)}
                  onChange={(v) => setDeadlineH(Number(v) as (typeof DEADLINE_HOURS)[number])}
                  options={DEADLINE_HOURS.map((h) => ({ value: String(h), label: `${h}h` }))}
                />
              </div>

              {canWager ? (
                <div className="rounded-2xl bg-inset p-3">
                  <Input
                    label={`Cost: ${effectiveWager} coins`}
                    type="range"
                    min={MIN_WAGER}
                    max={maxWager}
                    step={1}
                    value={effectiveWager}
                    onChange={(e) => setWager(Number(e.target.value))}
                    className="border-0 bg-transparent px-0 accent-cidash-primary focus:ring-0"
                  />
                  <div className="mt-1 grid grid-cols-2 gap-2 text-center text-xs font-semibold">
                    <span className="rounded-lg bg-success/10 py-1.5 text-success">Stakes: +{effectiveWager * 2} RP</span>
                    <span className="rounded-lg bg-danger/10 py-1.5 text-danger">Fail: −{effectiveWager * 2} RP</span>
                  </div>
                </div>
              ) : (
                <p className="rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
                  You need at least {MIN_WAGER} coins to send a Bomb Mission.{' '}
                  <button type="button" onClick={() => close(() => { onClose(); navigate(profileTopUp); })} className="font-bold underline">
                    Top up
                  </button>
                </p>
              )}

              {resting && (
                <p className="rounded-xl bg-warning/10 px-3 py-2 text-xs font-semibold text-warning">
                  You're in Rest Mode. Switch to Ready (Protection) before sending.
                </p>
              )}

              <Button fullWidth disabled={!canWager || resting} onClick={() => send(close)}>
                Send challenge · {canWager ? effectiveWager : 0} coins
              </Button>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
