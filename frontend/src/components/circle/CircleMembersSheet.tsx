import { useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import Icon from '../ui/Icon';
import { InitialAvatar } from '../ui/Picker';
import { useApp } from '../../store/AppContext';
import { useLiveRooms } from '../../hooks/useGroupRun';
import type { Circle } from '../../types';

interface CircleMembersSheetProps {
  circle: Circle;
  onClose: () => void;
  /** Tampilkan tombol "Open circle" (dipakai dari Profile). */
  onOpenCircle?: () => void;
}

/** Bottom sheet daftar anggota circle: role, status lari live, Rank Points, Kick (Captain), & Leave Circle. */
export default function CircleMembersSheet({ circle, onClose, onOpenCircle }: CircleMembersSheetProps) {
  const { membersOf, leaveCircle, kickMember } = useApp();
  const members = membersOf(circle.id);
  const myMember = members.find((m) => m.isMe);
  const amCaptain = myMember?.role === 'captain';

  const rooms = useLiveRooms(circle.id);
  const runningNow = new Set(rooms.filter((r) => r.status === 'live').flatMap((r) => r.participants.map((p) => p.userId)));
  const [copied, setCopied] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [kickingUserId, setKickingUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function shareInvite() {
    const text = `Join my circle "${circle.name}" on Cidash with code: ${circle.code}`;
    try {
      if (navigator.share) await navigator.share({ title: 'Cidash Circle', text });
      else {
        await navigator.clipboard.writeText(circle.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* dibatalkan user */
    }
  }

  async function handleKick(userId: string) {
    setBusy(true);
    try {
      await kickMember(circle.id, userId);
      setKickingUserId(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleLeave(close: (after?: () => void) => void) {
    setBusy(true);
    try {
      await leaveCircle(circle.id);
      close();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title={circle.name} onClose={onClose}>
      {(close) => (
        <div>
          <p className="-mt-3 mb-4 text-center text-sm text-subtle">
            {members.length} {members.length === 1 ? 'member' : 'members'}
            {runningNow.size > 0 && <span className="text-danger"> · {runningNow.size} running now</span>}
          </p>

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
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">
                      @{m.username}
                      {m.isMe && <span className="font-medium text-subtle"> (you)</span>}
                    </span>
                    {m.role === 'captain' && <Badge tone="warning">Captain</Badge>}
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
                  kickingUserId === m.id ? (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => void handleKick(m.id)}
                        className="rounded-lg bg-danger px-2 py-1 text-[11px] font-bold text-white"
                      >
                        Kick
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setKickingUserId(null)}
                        className="rounded-lg bg-inset px-2 py-1 text-[11px] font-semibold text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setKickingUserId(m.id)}
                      aria-label={`Remove @${m.username} from circle`}
                      className="rounded-lg p-1.5 text-subtle transition hover:bg-danger/10 hover:text-danger"
                    >
                      <Icon name="close" size={15} />
                    </button>
                  )
                )}
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Button fullWidth variant={onOpenCircle ? 'secondary' : 'primary'} onClick={shareInvite}>
              <Icon name={copied ? 'check' : 'plus'} size={16} />
              {copied ? 'Code copied' : `Invite friends · ${circle.code}`}
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
                      : `Are you sure you want to leave "${circle.name}"?`}
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
        </div>
      )}
    </Modal>
  );
}
