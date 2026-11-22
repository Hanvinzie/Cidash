import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import ConfirmDialog from '../ui/ConfirmDialog';
import Icon from '../ui/Icon';
import { InitialAvatar } from '../ui/Picker';
import { useApp } from '../../store/AppContext';
import { useLiveRooms } from '../../hooks/useGroupRun';
import type { Circle } from '../../types';

/** Biaya upgrade circle ke Premium (sama dengan AppContext.upgradeCircle dan backend). */
const UPGRADE_COST = 100;

interface CircleMembersSheetProps {
  circle: Circle;
  onClose: () => void;
  /** Tampilkan tombol "Open circle" (dipakai dari Profile). */
  onOpenCircle?: () => void;
}

/** Bottom sheet daftar anggota circle: role, status lari live, status Bomb Mission, kapasitas Free/Premium, Kick (Captain), & Leave Circle. */
export default function CircleMembersSheet({ circle, onClose, onOpenCircle }: CircleMembersSheetProps) {
  const { user, circles, membersOf, upgradeCircle, leaveCircle, kickMember } = useApp();
  const liveCircle = circles.find((c) => c.id === circle.id) ?? circle;
  const members = membersOf(liveCircle.id);
  const myMember = members.find((m) => m.isMe);
  const amCaptain = myMember?.role === 'captain';

  const isPremium = Boolean(liveCircle.isPremium);
  const maxMembers = liveCircle.maxMembers ?? (isPremium ? 25 : 5);

  const rooms = useLiveRooms(liveCircle.id);
  const runningNow = new Set(rooms.filter((r) => r.status === 'live').flatMap((r) => r.participants.map((p) => p.userId)));
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [kickTarget, setKickTarget] = useState<{ id: string; username: string } | null>(null);
  const [confirmUpgrade, setConfirmUpgrade] = useState(false);
  const [busy, setBusy] = useState(false);

  async function shareInvite() {
    const text = `Join my circle "${liveCircle.name}" on Cidash with code: ${liveCircle.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Cidash Circle', text });
      else {
        await navigator.clipboard.writeText(liveCircle.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* dibatalkan user */
    }
  }

  async function handleUpgrade() {
    setBusy(true);
    try {
      await upgradeCircle(liveCircle.id);
      setConfirmUpgrade(false);
    } finally {
      setBusy(false);
    }
  }

  async function handleKick() {
    if (!kickTarget) return;
    setBusy(true);
    try {
      await kickMember(liveCircle.id, kickTarget.id);
      setKickTarget(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(close: (after?: () => void) => void) {
    setBusy(true);
    try {
      await leaveCircle(liveCircle.id);
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={liveCircle.name} onClose={onClose}>
      {(close) => (
        <div>
          <div className="-mt-3 mb-4 flex flex-wrap items-center justify-center gap-2 text-center text-sm text-subtle">
            <span>
              {members.length}/{maxMembers} members
            </span>
            <Badge tone="neutral">{liveCircle.activityType === 'bike' ? 'Cycling' : 'Running'}</Badge>
            <Badge tone={isPremium ? 'primary' : 'neutral'}>
              {isPremium ? `Premium · Max ${maxMembers}` : `Free Tier · Max ${maxMembers}`}
            </Badge>
            {runningNow.size > 0 && <span className="text-danger">· {runningNow.size} running now</span>}
          </div>

          <ul className="-mx-2 mb-5">
            {members.map((m) => (
              <li key={m.id} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${m.isMe ? 'bg-cidash-primary/5' : ''}`}>
                <span className="relative">
                  <InitialAvatar text={m.username} />
                  {runningNow.has(m.id) && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-danger ring-2 ring-surface" aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold">
                      @{m.username}
                      {m.isMe && <span className="font-medium text-subtle"> (you)</span>}
                    </span>
                    {m.role === 'captain' && <Badge tone="warning">Captain</Badge>}
                    {m.availabilityStatus === 'RESTING' && <Badge tone="neutral">Resting</Badge>}
                    {m.availabilityStatus === 'IN_MISSION' && <Badge tone="primary">In Challenge</Badge>}
                  </span>
                  <span className="block text-xs text-subtle">
                    {runningNow.has(m.id) ? (
                      <span className="font-semibold text-danger">Running now</span>
                    ) : (
                      `${m.totalDistanceKm} km this season`
                    )}
                  </span>
                </span>
                <span className="text-right text-sm font-bold tabular-nums">
                  {m.rankPoints.toLocaleString('en-US')}
                  <span className="block text-[10px] font-medium text-subtle">RP</span>
                </span>

                {amCaptain && !m.isMe && (
                  <button
                    type="button"
                    onClick={() => setKickTarget({ id: m.id, username: m.username })}
                    aria-label={`Remove @${m.username} from circle`}
                    className="rounded-lg p-1.5 text-subtle transition hover:bg-danger/10 hover:text-danger active:scale-90"
                  >
                    <Icon name="close" size={15} />
                  </button>
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            {!isPremium && (
              <Button fullWidth variant="secondary" disabled={busy} onClick={() => setConfirmUpgrade(true)}>
                <Icon name="coin" size={15} />
                Upgrade to Premium Circle (Max 25 · 100 coins)
              </Button>
            )}

            <Button fullWidth variant={onOpenCircle ? 'secondary' : 'primary'} onClick={shareInvite}>
              <Icon name={copied ? 'check' : 'plus'} size={16} />
              {copied ? 'Code copied' : `Invite friends · ${liveCircle.code}`}
            </Button>
            {onOpenCircle && (
              <Button fullWidth onClick={() => close(onOpenCircle)}>
                Open circle <Icon name="chevronRight" size={16} />
              </Button>
            )}

            {!confirmLeave ? (
              <Button
                fullWidth
                variant="ghost"
                className="!text-danger hover:!bg-danger/10"
                onClick={() => setConfirmLeave(true)}
              >
                <Icon name="logout" size={15} /> Leave circle
              </Button>
            ) : (
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-3 text-center">
                <p className="mb-2.5 text-xs font-semibold text-ink">
                  {amCaptain && members.length > 1
                    ? 'Leave this circle? Captain role will transfer to the next longest-standing member.'
                    : amCaptain
                      ? 'Leave and delete this circle? You are the only member.'
                      : `Are you sure you want to leave "${liveCircle.name}"?`}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    fullWidth
                    disabled={busy}
                    onClick={() => setConfirmLeave(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="danger"
                    fullWidth
                    disabled={busy}
                    onClick={() => void handleLeave(close)}
                  >
                    {busy ? 'Leaving…' : 'Confirm leave'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {kickTarget && (
            <ConfirmDialog
              title={`Remove @${kickTarget.username}?`}
              confirmLabel="Remove from circle"
              tone="danger"
              busy={busy}
              onConfirm={handleKick}
              onCancel={() => setKickTarget(null)}
            >
              <p>
                <b>@{kickTarget.username}</b> will lose access to this circle's leaderboard, goals and challenges. They can join again with the
                invite code.
              </p>
            </ConfirmDialog>
          )}

          {confirmUpgrade && (
            <ConfirmDialog
              title="Upgrade to Premium?"
              confirmLabel={`Pay ${UPGRADE_COST} coins`}
              busy={busy}
              confirmDisabled={user.coins < UPGRADE_COST}
              onConfirm={handleUpgrade}
              onCancel={() => setConfirmUpgrade(false)}
            >
              <p>
                "{liveCircle.name}" grows from 5 to <b>25 members</b>. This costs <b>{UPGRADE_COST} coins</b> and cannot be undone.
              </p>
              <p className={`mt-2 font-semibold ${user.coins < UPGRADE_COST ? 'text-danger' : 'text-ink'}`}>
                Your balance: {user.coins} coins
                {user.coins < UPGRADE_COST && ` (need ${UPGRADE_COST - user.coins} more)`}
              </p>
            </ConfirmDialog>
          )}
        </div>
      )}
    </Modal>
  );
}
