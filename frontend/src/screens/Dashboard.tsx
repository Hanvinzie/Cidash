import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import Card from '../components/ui/Card';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import InstallBanner from '../components/ui/InstallBanner';
import { NoCircleCard } from '../components/circle/NoCircleGate';
import CircleMembersSheet from '../components/circle/CircleMembersSheet';
import LeaderboardList from '../components/circle/LeaderboardList';
import LeaderboardModal from '../components/circle/LeaderboardModal';
import Picker, { InitialAvatar } from '../components/ui/Picker';
import { useApp } from '../store/AppContext';
import { useToast } from '../store/ToastContext';
import { useLiveRooms } from '../hooks/useGroupRun';
import { activityFor, groupRunFor, joinLink, ROUTES } from '../routes';

const TOP_COUNT = 3;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, circles, activeCircle, setActiveCircle, leaderboard, myRank, groupMissions, claimGroupMission } = useApp();
  const navigate = useNavigate();
  const toast = useToast();
  const [showMembers, setShowMembers] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const liveRooms = useLiveRooms(activeCircle?.id);
  const liveRoom = liveRooms.find((r) => r.status === 'live') ?? liveRooms[0];

  if (!activeCircle) {
    return <NoCircleCard />;
  }

  const maxMembers = activeCircle.maxMembers ?? (activeCircle.isPremium ? 25 : 5);

  /** Bagikan TAUTAN undangan (bukan sekadar kode): membuka aplikasi lalu langsung bergabung ke circle ini. */
  async function handleShare() {
    const circle = activeCircle!;
    const url = joinLink(circle.code);
    const text = `Join my circle "${circle.name}" on Cidash!`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cidash circle invite', text, url });
        return;
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return; // user menutup lembar bagikan
      // gagal selain dibatalkan → coba salin
    }
    await copy(url, 'Invite link copied');
  }

  async function copy(value: string, okMessage: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast(okMessage, 'success');
    } catch {
      toast("Couldn't copy. Please copy it manually.", 'error');
    }
  }

  const stats = [
    { label: 'Rank Points', value: user.rankPoints.toLocaleString('en-US'), icon: 'flame' },
    { label: 'Season rank', value: myRank ? `#${myRank}` : '—', icon: 'trophy' },
  ] as const;

  return (
    <div className="space-y-7">
      {/* Greeting */}
      <div>
        <p className="text-sm text-muted">{greeting()},</p>
        <h1 className="text-2xl font-extrabold tracking-tight">@{user.username}</h1>
      </div>

      <InstallBanner />

      {/* Circle + stats */}
      <Card className="space-y-5 p-5">
        {/* Nama circle & jumlah anggota */}
        <div className="space-y-2">
          <Picker
            variant="title"
            label="Active circle"
            sheetTitle="Switch circle"
            value={activeCircle.id}
            onChange={setActiveCircle}
            options={circles.map((c) => {
              const cap = c.maxMembers ?? (c.isPremium ? 25 : 5);
              const sport = c.activityType === 'bike' ? 'Cycling' : 'Running';
              return {
                value: c.id,
                label: c.name,
                description: `${sport} · ${c.memberCount}/${cap} members (${c.isPremium ? 'Premium' : 'Free'}) · ${c.code}`,
                leading: <InitialAvatar text={c.name} />,
              };
            })}
          />
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="neutral">{activeCircle.activityType === 'bike' ? 'Cycling' : 'Running'}</Badge>
            <Badge tone={activeCircle.isPremium ? 'primary' : 'neutral'}>
              {activeCircle.isPremium ? 'Premium' : 'Free'}
            </Badge>
            <button
              type="button"
              onClick={() => setShowMembers(true)}
              className="flex items-center gap-1 rounded-full py-1 pl-1 text-xs font-semibold text-muted transition active:opacity-60"
              aria-label={`${activeCircle.memberCount} of ${maxMembers} members. View members`}
            >
              <Icon name="users" size={14} />
              {activeCircle.memberCount}/{maxMembers} members
              <Icon name="chevronRight" size={13} className="text-subtle" />
            </button>
          </div>
        </div>

        {/* Undangan: kode besar yang mudah dibaca + satu tombol aksi utama */}
        <div className="rounded-2xl bg-inset p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-subtle">Invite code</p>
              <p className="mt-0.5 font-mono text-2xl font-extrabold leading-none tracking-[0.22em] text-cidash-primary">
                {activeCircle.code}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void copy(activeCircle.code, 'Code copied')}
              aria-label={`Copy invite code ${activeCircle.code}`}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface text-muted shadow-card transition active:scale-90"
            >
              <Icon name="copy" size={18} />
            </button>
          </div>
          <Button fullWidth className="mt-3" onClick={() => void handleShare()}>
            <Icon name="share" size={16} /> Share invite link
          </Button>
        </div>

        {/* Rank Points & Season rank membuka leaderboard lengkap */}
        <dl className="grid grid-cols-2 divide-x divide-line rounded-2xl bg-inset">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setShowLeaderboard(true)}
              aria-haspopup="dialog"
              aria-label={`${s.label}: ${s.value}. Open leaderboard`}
              className="flex flex-col items-center gap-1 px-1 py-4 text-center transition first:rounded-l-2xl last:rounded-r-2xl active:bg-line/60"
            >
              <dd className="flex items-center gap-1.5 text-xl font-extrabold">
                <Icon name={s.icon} size={17} className="text-cidash-primary" />
                {s.value}
              </dd>
              <dt className="flex items-center gap-0.5 text-[11px] font-medium text-subtle">
                {s.label} <Icon name="chevronRight" size={11} />
              </dt>
            </button>
          ))}
        </dl>
      </Card>

      {/* Quick start */}
      <section aria-label="Start an activity" className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => navigate(ROUTES.activity)}
          className="flex flex-col items-start gap-3 rounded-2xl bg-cidash-primary p-4 text-left text-cidash-on-primary shadow-lg shadow-cidash-primary/25 transition hover:bg-cidash-primary-hover active:scale-[0.98]"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/20">
            <Icon name="play" size={20} />
          </span>
          <span>
            <span className="block font-bold">{activeCircle.activityType === 'bike' ? 'Solo ride' : 'Solo run'}</span>
            <span className="text-xs text-white/80">
              {activeCircle.activityType === 'bike' ? 'Track a ride' : 'Track a run'}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate(groupRunFor(liveRoom?.id))}
          className="relative flex flex-col items-start gap-3 rounded-2xl border border-line/70 bg-surface p-4 text-left shadow-card transition hover:border-cidash-primary/60 active:scale-[0.98]"
        >
          {liveRoom?.status === 'live' && (
            <span className="absolute right-4 top-4">
              <Badge tone="danger" dot pulse>
                Live
              </Badge>
            </span>
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name="users" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">{activeCircle.activityType === 'bike' ? 'Group ride' : 'Group run'}</span>
            <span className="block truncate text-xs text-muted">
              {liveRoom
                ? `${liveRoom.hostName} +${liveRoom.participants.length - 1} ${liveRoom.status === 'live' ? (activeCircle.activityType === 'bike' ? 'riding' : 'running') : 'in lobby'}`
                : 'Host the first session'}
            </span>
          </span>
        </button>
      </section>

      {/* Active missions */}
      <section>
        <SectionTitle
          action={
            <Link to={ROUTES.customQuest} className="flex items-center text-xs font-semibold text-cidash-primary">
              Challenges <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          Circle goals
        </SectionTitle>
        {groupMissions.length === 0 ? (
          <Card className="py-8 text-center text-sm text-subtle">No circle goals yet.</Card>
        ) : (
          <ul className="space-y-3">
            {groupMissions.map((m) => {
              const pct = Math.min(100, Math.round((m.progressKm / m.targetKm) * 100));
              const done = m.status === 'completed';
              return (
                <li key={m.id}>
                  <Card>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="mb-1 flex items-center gap-1.5">
                          <StatusBadge status={m.status} />
                          <Badge>{m.cadence === 'daily' ? 'Daily' : 'Weekly'}</Badge>
                          <Badge>{m.type === 'run' ? 'Run' : 'Ride'}</Badge>
                        </div>
                        <p className="font-bold">{m.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-subtle">
                          <Icon name="clock" size={12} /> Due {m.deadline}
                          {m.rewardRankPoints ? ` · +${m.rewardRankPoints} RP` : ''}
                          {m.rewardCoins ? ` · +${m.rewardCoins} coins` : ''}
                        </p>
                      </div>
                      <p className="shrink-0 text-right">
                        <span className="text-xl font-extrabold text-cidash-primary">{pct}%</span>
                      </p>
                    </div>
                    <div
                      className="mt-3 h-2 w-full overflow-hidden rounded-full bg-inset"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${m.title} progress`}
                    >
                      <div
                        className="h-full rounded-full bg-cidash-primary transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted">
                        {m.progressKm} / {m.targetKm} km
                      </p>
                      {!done ? (
                        <button
                          type="button"
                          onClick={() => navigate(activityFor(m.id))}
                          className="flex items-center text-xs font-semibold text-cidash-primary"
                        >
                          Start <Icon name="chevronRight" size={14} />
                        </button>
                      ) : m.claimed ? (
                        <span className="text-xs font-semibold text-emerald-500">Claimed ✓</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void claimGroupMission(m.circleId, m.cadence)}
                          className="rounded-full bg-cidash-primary px-3 py-1 text-xs font-semibold text-white transition active:scale-95"
                        >
                          Claim Reward
                        </button>
                      )}
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Leaderboard: hanya 3 teratas, lengkapnya di modal */}
      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="flex items-center text-xs font-semibold text-cidash-primary"
            >
              See all <Icon name="chevronRight" size={14} />
            </button>
          }
        >
          Leaderboard
        </SectionTitle>
        <Card className="p-0">
          <LeaderboardList entries={leaderboard.slice(0, TOP_COUNT)} myId={user.id} />
          {myRank !== null && myRank > TOP_COUNT && (
            <button
              type="button"
              onClick={() => setShowLeaderboard(true)}
              className="flex w-full items-center justify-between border-t border-line/70 bg-cidash-primary/5 px-4 py-3 text-left text-sm font-semibold text-cidash-primary transition active:bg-cidash-primary/10"
            >
              <span>Your position: #{myRank}</span>
              <Icon name="chevronRight" size={16} />
            </button>
          )}
        </Card>
      </section>
      {showLeaderboard && (
        <LeaderboardModal
          circleName={activeCircle.name}
          entries={leaderboard}
          myId={user.id}
          myRank={myRank}
          onClose={() => setShowLeaderboard(false)}
        />
      )}
      {showMembers && <CircleMembersSheet circle={activeCircle} onClose={() => setShowMembers(false)} />}
    </div>
  );
}
