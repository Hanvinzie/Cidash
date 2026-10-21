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

/** Bottom sheet daftar anggota circle: role, status lari live, Rank Points & jarak season. */
export default function CircleMembersSheet({ circle, onClose, onOpenCircle }: CircleMembersSheetProps) {
  const { membersOf } = useApp();
  const members = membersOf(circle.id);
  const rooms = useLiveRooms(circle.id);
  const runningNow = new Set(rooms.filter((r) => r.status === 'live').flatMap((r) => r.participants.map((p) => p.userId)));
  const [copied, setCopied] = useState(false);

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
          </div>
        </div>
      )}
    </Modal>
  );
}
