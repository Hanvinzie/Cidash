import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Icon, { type IconName } from '../ui/Icon';
import { useApp } from '../../store/AppContext';
import type { NotificationKind } from '../../lib/notifications';

const KIND_ICON: Record<NotificationKind, IconName> = {
  member_joined: 'users',
  member_left: 'users',
  kicked: 'logout',
  bomb_received: 'bomb',
  bomb_sent_to_other: 'bomb',
  bomb_result: 'shield',
  milestone: 'trophy',
};

const KIND_TONE: Partial<Record<NotificationKind, string>> = {
  kicked: 'bg-danger/10 text-danger',
  milestone: 'bg-warning/10 text-warning',
};

function timeAgo(at: number, now = Date.now()): string {
  const min = Math.floor((now - at) / 60_000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(at).toLocaleDateString('en-US', { dateStyle: 'medium' });
}

/** Pusat notifikasi. Membuka panel menandai semua terbaca; item yang baru tetap diberi penanda selama panel terbuka. */
export default function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { notifications, unreadCount, markNotificationsRead, circles } = useApp();
  // Item belum dibaca selalu yang terbaru (daftar urut terbaru dulu), jadi cukup menyimpan jumlahnya saat panel dibuka.
  const [newCount] = useState(unreadCount);
  const showCircle = circles.length > 1;

  useEffect(() => {
    markNotificationsRead();
  }, [markNotificationsRead]);

  return (
    <Modal title="Notifications" onClose={onClose}>
      {notifications.length === 0 ? (
        <div className="py-8 text-center">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-inset text-subtle">
            <Icon name="bell" size={24} />
          </span>
          <p className="font-bold">Nothing yet</p>
          <p className="mt-1 text-sm text-muted">
            New members, Bomb Challenges, and circle milestones show up here. Turn alerts on or off in Settings.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line/70" aria-label="Notifications">
          {notifications.map((n, i) => (
            <li key={n.id} className="flex items-start gap-3 py-3">
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${KIND_TONE[n.kind] ?? 'bg-cidash-primary/10 text-cidash-primary'}`}
              >
                <Icon name={KIND_ICON[n.kind]} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{n.text}</span>
                <span className="block text-xs text-subtle">
                  {timeAgo(n.at)}
                  {showCircle && ` · ${n.circleName}`}
                </span>
              </span>
              {i < newCount && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-cidash-primary" aria-label="New" />
              )}
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
