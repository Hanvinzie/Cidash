import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import InstallBanner from '../components/ui/InstallBanner';
import CircleMembersSheet from '../components/circle/CircleMembersSheet';
import LeaderboardList from '../components/circle/LeaderboardList';
import LeaderboardModal from '../components/circle/LeaderboardModal';
import Picker, { InitialAvatar } from '../components/ui/Picker';
import { useApp } from '../store/AppContext';
import { useLiveRooms } from '../hooks/useGroupRun';
import { activityFor, circleOnboarding, groupRunFor, ROUTES } from '../routes';

const TOP_COUNT = 3;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, circles, activeCircle, setActiveCircle, leaderboard, myRank, groupMissions, claimGroupMission } = useApp();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const liveRooms = useLiveRooms(activeCircle?.id);
  const liveRoom = liveRooms.find((r) => r.status === 'live') ?? liveRooms[0];

  if (!activeCircle) {
    return (
      <Card className="mt-10 p-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
          <Icon name="users" size={24} />
        </span>
        <p className="mb-1 font-bold">No circle yet</p>
        <p className="mb-5 text-sm text-muted">Create a private circle or join one with an invite code.</p>
        <Button onClick={() => navigate(circleOnboarding)}>Create or join a circle</Button>
      </Card>
    );
  }

  const maxMembers = activeCircle.maxMembers ?? (activeCircle.isPremium ? 25 : 5);

  async function handleShare() {
    const text = `Join my circle "${activeCircle!.name}" on Cidash with code: ${activeCircle!.code}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Cidash Circle', text });
      } else {
        await navigator.clipboard.writeText(activeCircle!.code);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      /* cancelled by the user */
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
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
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
            <button
              type="button"
              onClick={() => setShowMembers(true)}
              className="flex flex-wrap items-center gap-1 text-xs font-semibold text-subtle transition active:opacity-60"
            >
              <Icon name="users" size={13} />
              <span>
                {activeCircle.memberCount}/{maxMembers} members
              </span>
              <Badge tone="neutral">{activeCircle.activityType === 'bike' ? 'Cycling' : 'Running'}</Badge>
              <Badge tone={activeCircle.isPremium ? 'primary' : 'neutral'}>
                {activeCircle.isPremium ? 'Premium' : 'Free'}
              </Badge>
              <Icon name="chevronRight" size={13} />
            </button>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-inset px-3 py-2 transition hover:bg-line active:scale-95"
            aria-label={`Share invite code ${activeCircle.code}`}
          >
            <span className="font-mono text-sm font-bold tracking-widest text-cidash-primary">{activeCircle.code}</span>
            <Icon name={copied ? 'copy' : 'share'} size={16} className="text-muted" />
          </button>
        </div>
        {copied && (
          <p className="text-xs font-semibold text-success" aria-live="polite">
            Code copied
          </p>
        )}

        {/* Rank Points & Season rank membuka leaderboard lengkap */}
        <dl className="grid grid-cols-2 divide-x divide-line rounded-xl bg-inset">
          {stats.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setShowLeaderboard(true)}
              aria-haspopup="dialog"
              aria-label={`${s.label}: ${s.value}. Open leaderboard`}
              className="flex flex-col items-center gap-0.5 px-1 py-3 text-center transition first:rounded-l-xl last:rounded-r-xl active:bg-line/60"
            >
              <dd className="flex items-center gap-1 text-lg font-extrabold">
                <Icon name={s.icon} size={16} className="text-cidash-primary" />
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
              Bomb Missions <Icon name="chevronRight" size={14} />
            </Link>
          }
        >
          Circle missions
        </SectionTitle>
        {groupMissions.length === 0 ? (
          <Card className="py-8 text-center text-sm text-subtle">No missions in this circle yet.</Card>
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
