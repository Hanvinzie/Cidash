import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import { Input, Segmented } from '../components/ui/Field';
import Picker, { InitialAvatar } from '../components/ui/Picker';
import { useApp } from '../store/AppContext';
import { activityFor, profileTopUp } from '../routes';
import type { ActivityType, QuestDirection } from '../types';

const MIN_WAGER = 5;
const MAX_WAGER = 100;

/** Date -> datetime-local input value (local timezone). */
function toLocalInput(d: Date) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}
const hoursFromNow = (h: number) => toLocalInput(new Date(Date.now() + h * 3_600_000));
const defaultDeadline = () => hoursFromNow(24);
const DEADLINE_PRESETS = [6, 12, 24, 48];

export default function CustomQuest() {
  const { user, members, bombMissions, sendBomb, acceptBomb, rejectBomb, useShield } = useApp();
  const navigate = useNavigate();

  const [tab, setTab] = useState<QuestDirection>('incoming');
  const [showForm, setShowForm] = useState(false);
  const [confirmDeclineId, setConfirmDeclineId] = useState<string | null>(null);

  // Bomb mission form state
  const [targetUserId, setTargetUserId] = useState(members[0]?.id ?? '');
  const effectiveTargetId = members.some((m) => m.id === targetUserId) ? targetUserId : (members[0]?.id ?? '');
  const [activityType, setActivityType] = useState<ActivityType>('run');
  const [targetKm, setTargetKm] = useState(3);
  const [durationMin, setDurationMin] = useState(25);
  const [deadline, setDeadline] = useState(defaultDeadline);
  const maxWager = Math.min(user.coins, MAX_WAGER);
  const canWager = maxWager >= MIN_WAGER;
  const [wager, setWager] = useState(Math.max(MIN_WAGER, Math.min(20, maxWager)));
  const effectiveWager = Math.min(wager, maxWager);

  const shieldCount = user.shieldTickets ?? 0;

  const counts = {
    incoming: bombMissions.filter((q) => q.direction === 'incoming').length,
    sent: bombMissions.filter((q) => q.direction === 'sent').length,
  };
  const visibleQuests = bombMissions.filter((q) => q.direction === tab);
  const minDeadline = toLocalInput(new Date());

  function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canWager || !effectiveTargetId) return;
    sendBomb({
      targetUserId: effectiveTargetId,
      type: activityType,
      targetKm,
      durationMin,
      deadline,
      wagerCoins: effectiveWager,
    });
    setShowForm(false);
    setTab('sent');
  }

  function handleAccept(id: string) {
    acceptBomb(id);
    navigate(activityFor(id));
  }

  return (
    <div className="space-y-6">
      {/* Shield Ticket balance info */}
      <div className="flex items-center justify-between rounded-2xl border border-line/70 bg-surface px-4 py-3 shadow-card">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name="shield" size={18} />
          </span>
          <div>
            <p className="text-xs font-bold">Shield Tickets</p>
            <p className="text-[11px] text-subtle">Blocks RP penalty when declining a mission</p>
          </div>
        </div>
        <Badge tone={shieldCount > 0 ? 'primary' : 'neutral'}>
          {shieldCount} {shieldCount === 1 ? 'ticket' : 'tickets'}
        </Badge>
      </div>

      {/* Create Bomb Mission */}
      <Card className={showForm ? 'border-cidash-primary/40' : ''}>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          aria-expanded={showForm}
          aria-controls="bomb-form"
          className="flex w-full items-center gap-3 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary text-cidash-on-primary">
            <Icon name={showForm ? 'close' : 'quest'} size={20} />
          </span>
          <span className="flex-1">
            <span className="block font-bold">{showForm ? 'Close form' : 'Send a Bomb Mission'}</span>
            <span className="text-xs text-muted">Dare a friend — put coins on the line.</span>
          </span>
          {!showForm && <Icon name="chevronRight" size={18} className="text-subtle" />}
        </button>

        {showForm && (
          <div id="bomb-form" className="mt-5 border-t border-line/70 pt-5">
            {members.length === 0 ? (
              <p className="text-center text-sm text-muted">There are no other members in this circle yet.</p>
            ) : (
              <form onSubmit={handleCreate} className="space-y-4">
                <Picker
                  label="Challenge"
                  sheetTitle="Who are you challenging?"
                  value={effectiveTargetId}
                  onChange={setTargetUserId}
                  options={members.map((m) => ({
                    value: m.id,
                    label: `@${m.username}`,
                    leading: <InitialAvatar text={m.username} />,
                  }))}
                />

                <Segmented
                  ariaLabel="Activity type"
                  value={activityType}
                  onChange={setActivityType}
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
                    value={targetKm}
                    onChange={(e) => setTargetKm(Number(e.target.value))}
                    required
                  />
                  <Input
                    label="Time limit (min)"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={600}
                    value={durationMin}
                    onChange={(e) => setDurationMin(Number(e.target.value))}
                    required
                  />
                </div>
                <Input
                  label="Deadline"
                  type="datetime-local"
                  min={minDeadline}
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  required
                  hint={
                    <span className="flex flex-wrap gap-2">
                      {DEADLINE_PRESETS.map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setDeadline(hoursFromNow(h))}
                          className="rounded-full border border-line px-2.5 py-1 font-semibold text-muted transition hover:border-cidash-primary hover:text-cidash-primary"
                        >
                          +{h}h
                        </button>
                      ))}
                    </span>
                  }
                />

                {canWager ? (
                  <div className="rounded-xl bg-inset p-3">
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
                      <span className="rounded-lg bg-success/10 py-1.5 text-success">Target Stakes: +{effectiveWager * 2} RP</span>
                      <span className="rounded-lg bg-danger/10 py-1.5 text-danger">Fail Penalty: −{effectiveWager * 2} RP</span>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl bg-warning/10 p-3 text-xs font-medium text-warning">
                    You need at least {MIN_WAGER} coins to send a Bomb Mission.{' '}
                    <button type="button" onClick={() => navigate(profileTopUp)} className="font-bold underline">
                      Top up
                    </button>
                  </p>
                )}

                <Button type="submit" fullWidth disabled={!canWager}>
                  Send challenge · {canWager ? effectiveWager : 0} coins
                </Button>
              </form>
            )}
          </div>
        )}
      </Card>

      {/* Incoming & sent quests */}
      <section>
        <SectionTitle>Your quests</SectionTitle>
        <div className="mb-4">
          <Segmented
            ariaLabel="Quest direction"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'incoming', label: `Received (${counts.incoming})` },
              { value: 'sent', label: `Sent (${counts.sent})` },
            ]}
          />
        </div>

        {visibleQuests.length === 0 ? (
          <Card className="py-10 text-center text-sm text-subtle">
            No {tab === 'incoming' ? 'received' : 'sent'} quests yet.
          </Card>
        ) : (
          <ul className="space-y-3">
            {visibleQuests.map((q) => (
              <li key={q.id}>
                <Card>
                  <div className="flex items-center gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 font-bold uppercase text-cidash-primary"
                      aria-hidden
                    >
                      {q.counterpart.username.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-subtle">
                        {q.direction === 'incoming' ? 'From' : 'To'}{' '}
                        <span className="font-semibold text-ink">@{q.counterpart.username}</span>
                      </p>
                      <p className="truncate font-bold">
                        {q.type === 'run' ? 'Run' : 'Ride'} {q.targetKm} km in {q.durationMin} min
                      </p>
                    </div>
                    <Badge tone="warning">
                      <Icon name="coin" size={12} /> {q.wagerCoins}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center justify-between rounded-xl bg-inset px-3 py-2 text-xs">
                    <span className="flex items-center gap-1 text-muted">
                      <Icon name="clock" size={12} /> {q.deadline}
                    </span>
                    <span className="font-semibold">
                      <span className="text-success">+{q.rewardRankPoints}</span>
                      <span className="text-subtle"> / </span>
                      <span className="text-danger">−{q.penaltyRankPoints} RP</span>
                    </span>
                    <StatusBadge status={q.status} />
                  </div>

                  {q.direction === 'incoming' && q.status === 'pending' && (
                    confirmDeclineId === q.id ? (
                      <div className="mt-3 rounded-xl border border-danger/30 bg-danger/5 p-3 text-center">
                        <p className="mb-2 text-xs font-semibold text-ink">
                          {shieldCount > 0
                            ? 'Use 1 Shield Ticket to block this challenge with 0 RP penalty?'
                            : `Declining without a Shield Ticket will deduct ${q.penaltyRankPoints} RP. Continue?`}
                        </p>
                        <div className="flex gap-2">
                          <Button size="sm" variant="secondary" fullWidth onClick={() => setConfirmDeclineId(null)}>
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            variant={shieldCount > 0 ? 'primary' : 'danger'}
                            fullWidth
                            onClick={() => {
                              setConfirmDeclineId(null);
                              if (shieldCount > 0) useShield(q.id);
                              else rejectBomb(q.id);
                            }}
                          >
                            {shieldCount > 0 ? 'Use Shield (0 RP)' : `Decline (−${q.penaltyRankPoints} RP)`}
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          fullWidth
                          onClick={() => setConfirmDeclineId(q.id)}
                        >
                          {shieldCount > 0 ? (
                            <>
                              <Icon name="shield" size={14} /> Shield
                            </>
                          ) : (
                            'Decline'
                          )}
                        </Button>
                        <Button size="sm" fullWidth onClick={() => handleAccept(q.id)}>
                          Accept & start
                        </Button>
                      </div>
                    )
                  )}
                  {q.direction === 'incoming' && q.status === 'in_progress' && (
                    <div className="mt-3 flex gap-2">
                      {shieldCount > 0 && (
                        <Button size="sm" variant="secondary" onClick={() => useShield(q.id)}>
                          <Icon name="shield" size={14} /> Shield
                        </Button>
                      )}
                      <Button size="sm" fullWidth onClick={() => navigate(activityFor(q.id))}>
                        Continue <Icon name="chevronRight" size={14} />
                      </Button>
                    </div>
                  )}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
