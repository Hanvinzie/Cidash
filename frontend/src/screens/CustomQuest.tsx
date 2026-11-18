import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import SwipeToDelete from '../components/ui/SwipeToDelete';
import { Segmented } from '../components/ui/Field';
import ProtectionModal from '../components/quest/ProtectionModal';
import SendBombModal from '../components/quest/SendBombModal';
import { statusLabel, useProtection } from '../components/quest/useProtection';
import { useHiddenQuests } from '../lib/hiddenQuests';
import { DIFFICULTY_LABEL } from '../lib/questPricing';
import { useApp } from '../store/AppContext';
import { activityFor } from '../routes';
import type { BombMission, QuestDirection } from '../types';

const SNOOZE_COST = 10;

const isFinished = (q: BombMission) => q.status === 'completed' || q.status === 'failed' || q.status === 'shielded';

/** Kalimat hasil akhir misi dari sudut pandang pengguna (pengirim atau penerima). */
function outcomeText(q: BombMission): string {
  const who = `@${q.counterpart.username}`;
  if (q.direction === 'sent') {
    if (q.status === 'shielded') return `${who} used a Shield Ticket. No RP changed hands.`;
    if (q.status === 'failed') return `${who} didn't finish. You won +${q.rewardRankPoints} RP.`;
    return `${who} completed it and won +${q.rewardRankPoints} RP.`;
  }
  if (q.status === 'shielded') return 'You used a Shield Ticket. No RP lost.';
  if (q.status === 'failed') return `You didn't finish. −${q.penaltyRankPoints} RP.`;
  return `You completed it! +${q.rewardRankPoints} RP.`;
}

export default function CustomQuest() {
  const { user, bombMissions, acceptBomb, rejectBomb, useShield, snoozeBomb } = useApp();
  const { myStatus, shieldCount, maxShields } = useProtection();
  const { hidden, hide } = useHiddenQuests(user.id);
  const navigate = useNavigate();

  const [tab, setTab] = useState<QuestDirection>('incoming');
  const [sending, setSending] = useState(false);
  const [protectionOpen, setProtectionOpen] = useState(false);
  /** Quest yang panel "More" (Shield / Decline / +12h) sedang dibuka. Satu aksi utama per kartu, sisanya tersembunyi. */
  const [moreId, setMoreId] = useState<string | null>(null);

  const status = statusLabel(myStatus);
  const visible = bombMissions.filter((q) => !hidden.has(q.id));
  const counts = {
    incoming: visible.filter((q) => q.direction === 'incoming').length,
    sent: visible.filter((q) => q.direction === 'sent').length,
  };
  const inTab = visible.filter((q) => q.direction === tab);
  const active = inTab.filter((q) => !isFinished(q));
  const finished = inTab.filter(isFinished);

  function handleAccept(id: string) {
    acceptBomb(id);
    navigate(activityFor(id));
  }

  function renderActive(q: BombMission) {
    const pending = q.direction === 'incoming' && q.status === 'pending';
    const inProgress = q.direction === 'incoming' && q.status === 'in_progress';
    const canAct = pending || inProgress;
    return (
      <Card>
        <QuestHeader q={q} />
        {canAct && (
          <div className="mt-3 space-y-2">
            <Button size="sm" fullWidth onClick={() => (pending ? handleAccept(q.id) : navigate(activityFor(q.id)))}>
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
    );
  }

  function renderFinished(q: BombMission) {
    const tone = q.status === 'completed' ? 'text-success' : q.status === 'failed' ? 'text-danger' : 'text-muted';
    return (
      <Card className="!rounded-2xl">
        <QuestHeader q={q} />
        <p className={`mt-3 text-xs font-semibold ${tone}`}>{outcomeText(q)}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      {/* Hierarki: 1) satu aksi utama yang menonjol, 2) daftar quest, 3) pengaturan perlindungan yang ringkas */}
      <button
        type="button"
        onClick={() => setSending(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-4 rounded-3xl bg-cidash-primary p-4 text-left text-cidash-on-primary shadow-lg shadow-cidash-primary/30 transition hover:bg-cidash-primary-hover active:scale-[0.98]"
      >
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/20">
          <Icon name="bomb" size={26} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold leading-tight">Send a Bomb Mission</span>
          <span className="block text-xs text-white/85">Dare a friend. Put coins on the line.</span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-cidash-primary">
          <Icon name="plus" size={20} strokeWidth={2.6} />
        </span>
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

        {inTab.length === 0 ? (
          <Card className="py-10 text-center text-sm text-subtle">
            No {tab === 'incoming' ? 'received' : 'sent'} quests yet.
          </Card>
        ) : (
          <div className="space-y-5">
            {active.length > 0 && (
              <ul className="space-y-3" aria-label="Active quests">
                {active.map((q) => (
                  <li key={q.id}>{renderActive(q)}</li>
                ))}
              </ul>
            )}

            {finished.length > 0 && (
              <div>
                <div className="mb-2 flex items-baseline justify-between px-1">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-subtle">Finished</h3>
                  <span className="text-[11px] text-subtle">Swipe left to delete</span>
                </div>
                <ul className="space-y-3" aria-label="Finished quests">
                  {finished.map((q) => (
                    <li key={q.id}>
                      <SwipeToDelete onDelete={() => hide(q.id)} label="Delete">
                        {renderFinished(q)}
                      </SwipeToDelete>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={() => setProtectionOpen(true)}
        aria-haspopup="dialog"
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left transition active:scale-[0.99]"
      >
        <Icon name="shield" size={18} className="shrink-0 text-muted" />
        <span className="min-w-0 flex-1 text-sm font-semibold">
          Protection <Badge tone={status.tone}>{status.text}</Badge>
          <span className="block text-xs font-normal text-subtle">
            {shieldCount}/{maxShields} Shield Tickets · Rest Mode
          </span>
        </span>
        <Icon name="chevronRight" size={16} className="text-subtle" />
      </button>

      {sending && <SendBombModal onClose={() => setSending(false)} onSent={() => setTab('sent')} />}
      {protectionOpen && <ProtectionModal onClose={() => setProtectionOpen(false)} />}
    </div>
  );
}

/** Kepala kartu: pihak lawan, ringkasan misi, kesulitan, koin, tenggat, RP, dan status. */
function QuestHeader({ q }: { q: BombMission }) {
  return (
    <>
      <div className="flex items-center gap-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 font-bold uppercase text-cidash-primary"
          aria-hidden
        >
          {q.counterpart.username.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs text-subtle">
            {q.direction === 'incoming' ? 'From' : 'To'} <span className="font-semibold text-ink">@{q.counterpart.username}</span>
          </p>
          <p className="truncate font-bold">
            {q.type === 'run' ? 'Run' : 'Ride'} {q.targetKm} km in {q.durationMin} min
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          <Badge tone="warning">
            <Icon name="coin" size={12} /> {q.wagerCoins}
          </Badge>
          {q.difficulty && <span className="text-[10px] font-bold uppercase text-subtle">{DIFFICULTY_LABEL[q.difficulty]}</span>}
        </div>
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
    </>
  );
}
