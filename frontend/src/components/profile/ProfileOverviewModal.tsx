import type { ReactNode } from 'react';
import Badge from '../ui/Badge';
import Icon, { type IconName } from '../ui/Icon';
import Modal from '../ui/Modal';
import { formatDuration, formatPace } from '../../lib/geo';
import { useApp } from '../../store/AppContext';

const DAY_MS = 86_400_000;

function memberSince(iso?: string): { date: string; ago: string } | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / DAY_MS));
  const ago =
    days < 1 ? 'Joined today' : days < 31 ? `${days} day${days === 1 ? '' : 's'} ago` : days < 365 ? `${Math.floor(days / 30)} months ago` : `${(days / 365).toFixed(1)} years ago`;
  return { date: d.toLocaleDateString('en-US', { dateStyle: 'long' }), ago };
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h4 className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wide text-subtle">{title}</h4>
      {children}
    </section>
  );
}

function Stat({ label, value, icon }: { label: string; value: ReactNode; icon?: IconName }) {
  return (
    <div className="rounded-2xl bg-inset px-3.5 py-3">
      <dd className="flex items-center gap-1.5 text-lg font-extrabold tabular-nums">
        {icon && <Icon name={icon} size={15} className="text-cidash-primary" />}
        {value}
      </dd>
      <dt className="text-[11px] font-medium text-subtle">{label}</dt>
    </div>
  );
}

/** Ringkasan lengkap akun: tanggal daftar, performa, misi, dan dompet. Dibuka dengan menekan kartu profil. */
export default function ProfileOverviewModal({ onClose }: { onClose: () => void }) {
  const { user, circles, activeCircle, myRank, activityHistory, activitySummary, bombMissions } = useApp();

  // Total dari server bila ada; mode demo memakai riwayat lokal.
  const workouts = activitySummary?.workouts ?? activityHistory.length;
  const totalKm = activitySummary?.distanceKm ?? activityHistory.reduce((n, a) => n + a.distanceKm, 0);
  const totalSec = activitySummary
    ? activitySummary.durationMinutes * 60
    : activityHistory.reduce((n, a) => n + a.durationSec, 0);
  const longest = activityHistory.reduce((best, a) => (a.distanceKm > best ? a.distanceKm : best), 0);
  const runs = activityHistory.filter((a) => a.type === 'run').length;
  const rides = activityHistory.length - runs;

  const count = (status: string) => bombMissions.filter((m) => m.status === status).length;
  const since = memberSince(user.createdAt);
  const shields = user.shieldTickets ?? 0;

  return (
    <Modal title="Profile overview" onClose={onClose} showTitle={false}>
      {/* pt-3: ring avatar (ring-4) keluar dari kotaknya dan akan terpotong overflow bila tidak diberi ruang.
          Tinggi dihitung dari batas sheet (92dvh) dikurangi handle, padding bawah, dan safe area. */}
      <div className="-mx-1 max-h-[calc(92dvh-6.5rem)] space-y-5 overflow-y-auto px-1 pb-2 pt-3">
        <div className="flex flex-col items-center text-center">
          <span
            className="flex h-20 w-20 items-center justify-center rounded-full bg-cidash-primary text-3xl font-extrabold uppercase text-cidash-on-primary ring-4 ring-cidash-primary/15"
            aria-hidden
          >
            {user.username.charAt(0)}
          </span>
          <h3 className="mt-3 text-xl font-extrabold">@{user.username}</h3>
          {user.email && <p className="text-xs text-subtle">{user.email}</p>}
          <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
            <Badge tone="primary">
              <Icon name="flame" size={12} /> {user.rankPoints.toLocaleString('en-US')} RP
            </Badge>
            {myRank && activeCircle && <Badge tone="neutral">#{myRank} in {activeCircle.name}</Badge>}
          </div>
        </div>

        <Section title="Account">
          <dl className="divide-y divide-line/70 rounded-2xl bg-inset text-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-muted">Member since</dt>
              <dd className="text-right font-semibold">
                {since ? (
                  <>
                    {since.date}
                    <span className="block text-[11px] font-medium text-subtle">{since.ago}</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <dt className="text-muted">Circles</dt>
              <dd className="font-semibold">{circles.length}</dd>
            </div>
          </dl>
        </Section>

        <Section title="Performance">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Activities" value={workouts} icon="activity" />
            <Stat label="Total distance" value={`${totalKm.toFixed(1)} km`} icon="map" />
            <Stat label="Total time" value={totalSec > 0 ? formatDuration(totalSec) : '—'} icon="clock" />
            <Stat label="Average pace" value={totalKm > 0 ? `${formatPace(totalSec, totalKm)} /km` : '—'} />
            <Stat label="Longest (recent)" value={longest > 0 ? `${longest.toFixed(1)} km` : '—'} />
            <Stat label="Runs / Rides (recent)" value={`${runs} / ${rides}`} />
          </dl>
        </Section>

        <Section title="Bomb Challenges">
          <dl className="grid grid-cols-4 gap-2 text-center">
            <Stat label="Active" value={count('pending') + count('in_progress')} />
            <Stat label="Done" value={count('completed')} />
            <Stat label="Failed" value={count('failed')} />
            <Stat label="Shielded" value={count('shielded')} />
          </dl>
        </Section>

        <Section title="Wallet">
          <dl className="grid grid-cols-2 gap-2">
            <Stat label="Coins" value={user.coins.toLocaleString('en-US')} icon="coin" />
            <Stat label={`Shield Tickets (max ${user.maxShieldTickets ?? 2})`} value={shields} icon="shield" />
          </dl>
        </Section>
      </div>
    </Modal>
  );
}
