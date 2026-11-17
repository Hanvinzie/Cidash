import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import { Segmented } from '../components/ui/Field';
import ProtectionModal from '../components/quest/ProtectionModal';
import SendBombModal from '../components/quest/SendBombModal';
import { statusLabel, useProtection } from '../components/quest/useProtection';
import { useApp } from '../store/AppContext';
import { activityFor } from '../routes';
import type { QuestDirection } from '../types';

const SNOOZE_COST = 10;

export default function CustomQuest() {
  const { bombMissions, acceptBomb, rejectBomb, useShield, snoozeBomb } = useApp();
  const { myStatus, shieldCount, maxShields } = useProtection();
  const navigate = useNavigate();

  const [tab, setTab] = useState<QuestDirection>('incoming');
  const [sending, setSending] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  /** Quest yang panel "More" (Shield / Decline / +12h) sedang dibuka. Satu aksi utama per kartu, sisanya tersembunyi. */
  const [moreId, setMoreId] = useState<string | null>(null);

  const status = statusLabel(myStatus);
  const counts = {
    incoming: bombMissions.filter((q) => q.direction === 'incoming').length,
    sent: bombMissions.filter((q) => q.direction === 'sent').length,
  };
  const visibleQuests = bombMissions.filter((q) => q.direction === tab);

  function handleAccept(id: string) {
    acceptBomb(id);
    navigate(activityFor(id));
  }

  return (
    <div className="space-y-5">
      {/* Satu aksi utama */}
      <button type="button" onClick={() => setSending(true)} className="block w-full text-left" aria-haspopup="dialog">
        <Card className="flex items-center gap-3 border-cidash-primary/30 bg-cidash-primary/5 p-4 transition active:scale-[0.99]">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-cidash-primary text-cidash-on-primary">
            <Icon name="quest" size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Send a Bomb Mission</span>
            <span className="block text-xs text-muted">Dare a friend. Put coins on the line.</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-subtle" />
        </Card>
      </button>

      {/* Status & Shield: ringkas, detail di modal */}
      <button type="button" onClick={() => setProtectionOpen(true)} className="block w-full text-left" aria-haspopup="dialog">
        <Card className="flex items-center gap-3 p-3.5 transition active:scale-[0.99]">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-inset text-muted">
            <Icon name="shield" size={18} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-sm font-bold">
              Protection <Badge tone={status.tone}>{status.text}</Badge>
            </span>
            <span className="block text-xs text-subtle">
              {shieldCount}/{maxShields} Shield Tickets · Rest Mode
            </span>
          </span>
          <Icon name="chevronRight" size={16} className="text-subtle" />
        </Card>
      </button>

      <section>
        <SectionTitle>Your quests</SectionTitle>
        <div className="mb-4">
          <Segmented
            ariaLabel="Quest direction"
            value={tab}
            onChange={(v) => {
              setTab(v);
              setMoreId(null);
            }}
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
            {visibleQuests.map((q) => {
              const pending = q.direction === 'incoming' && q.status === 'pending';
              const inProgress = q.direction === 'incoming' && q.status === 'in_progress';
              const canAct = pending || inProgress;
              return (
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

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-inset px-3 py-2 text-xs">
                      <span className="flex items-center gap-1 text-muted">
                        <Icon name="clock" size={12} /> {q.deadline}
                        {q.snoozed && <Badge tone="neutral">+12h</Badge>}
                      </span>
                      <span className="font-semibold">
                        <span className="text-success">+{q.rewardRankPoints}</span>
                        <span className="text-subtle"> / </span>
                        <span className="text-danger">−{q.penaltyRankPoints} RP</span>
                      </span>
                      <StatusBadge status={q.status} />
                    </div>

                    {canAct && (
                      <div className="mt-3 space-y-2">
                        <Button
                          size="sm"
                          fullWidth
                          onClick={() => (pending ? handleAccept(q.id) : navigate(activityFor(q.id)))}
                        >
                          {pending ? 'Accept & start' : 'Continue'} <Icon name="chevronRight" size={14} />
                        </Button>
                        <button
                          type="button"
                          onClick={() => setMoreId(moreId === q.id ? null : q.id)}
                          aria-expanded={moreId === q.id}
                          className="flex w-full items-center justify-center gap-1 py-1 text-xs font-semibold text-subtle"
                        >
                          {moreId === q.id ? 'Hide options' : 'More options'}
                        </button>

                        {moreId === q.id && (
                          <div className="space-y-2 rounded-xl bg-inset p-3">
                            <p className="text-xs text-muted">
                              {shieldCount > 0
                                ? `A Shield Ticket blocks this challenge with 0 RP penalty and refunds ${Math.floor(q.wagerCoins / 2)} coins to @${q.counterpart.username}.`
                                : pending
                                  ? `Declining without a Shield Ticket deducts ${q.penaltyRankPoints} RP.`
                                  : 'Need more time? Add 12 hours to the deadline.'}
                            </p>
                            {(shieldCount > 0 || pending) && (
                              <Button
                                size="sm"
                                fullWidth
                                variant={shieldCount > 0 ? 'primary' : 'danger'}
                                onClick={() => {
                                  setMoreId(null);
                                  if (shieldCount > 0) useShield(q.id);
                                  else rejectBomb(q.id);
                                }}
                              >
                                {shieldCount > 0 ? (
                                  <>
                                    <Icon name="shield" size={14} /> Use Shield (0 RP)
                                  </>
                                ) : (
                                  `Decline (−${q.penaltyRankPoints} RP)`
                                )}
                              </Button>
                            )}
                            {!q.snoozed && (
                              <Button size="sm" fullWidth variant="secondary" onClick={() => snoozeBomb(q.id)}>
                                <Icon name="clock" size={14} /> Add 12h · {SNOOZE_COST} coins
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {sending && <SendBombModal onClose={() => setSending(false)} onSent={() => setTab('sent')} />}
      {protectionOpen && <ProtectionModal onClose={() => setProtectionOpen(false)} />}
    </div>
  );
}
