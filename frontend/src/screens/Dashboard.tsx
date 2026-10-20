import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import { useApp } from '../store/AppContext';
import { useLiveRooms } from '../hooks/useGroupRun';
import { activityFor, circleOnboarding, groupRunFor, ROUTES } from '../routes';

const MEDAL = ['bg-amber-400 text-amber-950', 'bg-slate-300 text-slate-800', 'bg-orange-300 text-orange-950'];

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { user, circles, activeCircle, setActiveCircle, leaderboard, myRank, groupMissions } = useApp();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
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

      {/* Circle + stats */}
      <Card className="space-y-4">
        <div className="flex items-center gap-3">
          <label htmlFor="circle-switcher" className="sr-only">
            Active circle
          </label>
          <div className="min-w-0 flex-1">
            <div className="relative">
              <select
                id="circle-switcher"
                value={activeCircle.id}
                onChange={(e) => setActiveCircle(e.target.value)}
                className="w-full cursor-pointer appearance-none truncate bg-transparent py-0.5 pr-6 text-lg font-bold text-ink outline-none"
              >
                {circles.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <Icon name="chevronRight" size={16} className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 rotate-90 text-subtle" />
            </div>
            <p className="text-xs text-subtle">{activeCircle.memberCount} members</p>
          </div>
          <button
            type="button"
            onClick={handleShare}
            className="flex shrink-0 items-center gap-2 rounded-xl bg-inset px-3 py-2 transition hover:bg-line"
            aria-label={`Share invite code ${activeCircle.code}`}
          >
            <span className="font-mono text-sm font-bold tracking-widest text-cidash-primary">{activeCircle.code}</span>
            <Icon name={copied ? 'copy' : 'share'} size={16} className="text-muted" />
          </button>
        </div>
        {copied && <p className="text-xs font-semibold text-success" aria-live="polite">Code copied</p>}

        <dl className="grid grid-cols-2 divide-x divide-line rounded-xl bg-inset py-3">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center gap-0.5 px-1 text-center">
              <dd className="flex items-center gap-1 text-lg font-extrabold">
                <Icon name={s.icon} size={16} className="text-cidash-primary" />
                {s.value}
              </dd>
              <dt className="text-[11px] font-medium text-subtle">{s.label}</dt>
            </div>
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
            <span className="block font-bold">Solo run</span>
            <span className="text-xs text-white/80">Track a run or ride</span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate(groupRunFor(liveRoom?.id))}
          className="relative flex flex-col items-start gap-3 rounded-2xl border border-line/70 bg-surface p-4 text-left shadow-card transition hover:border-cidash-primary/60 active:scale-[0.98]"
        >
          {liveRoom?.status === 'live' && (
            <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold text-danger">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-danger" /> LIVE
            </span>
          )}
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name="users" size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-bold">Group run</span>
            <span className="block truncate text-xs text-muted">
              {liveRoom
                ? `${liveRoom.hostName} +${liveRoom.participants.length - 1} ${liveRoom.status === 'live' ? 'running' : 'in lobby'}`
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
                        </div>
                        <p className="font-bold">{m.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-subtle">
                          <Icon name="clock" size={12} /> Due {m.deadline}
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
                      <div className="h-full rounded-full bg-cidash-primary transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <p className="text-xs text-muted">
                        {m.progressKm} / {m.targetKm} km
                      </p>
                      {!done && (
                        <button
                          type="button"
                          onClick={() => navigate(activityFor(m.id))}
                          className="flex items-center text-xs font-semibold text-cidash-primary"
                        >
                          Start <Icon name="chevronRight" size={14} />
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

      {/* Leaderboard */}
      <section>
        <SectionTitle action={<span className="text-xs text-subtle">Resets quarterly</span>}>Leaderboard</SectionTitle>
        <Card className="p-0">
          <ol className="divide-y divide-line/70">
            {leaderboard.map((e) => {
              const isMe = e.user.id === user.id;
              return (
                <li
                  key={e.user.id}
                  className={`flex items-center gap-3 px-4 py-3 ${isMe ? 'bg-cidash-primary/5' : ''}`}
                >
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      MEDAL[e.rank - 1] ?? 'bg-inset text-subtle'
                    }`}
                  >
                    {e.rank}
                  </span>
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-sm font-bold uppercase text-cidash-primary"
                    aria-hidden
                  >
                    {e.user.username.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">
                      {e.user.username}
                      {isMe && <span className="ml-1.5 text-xs font-semibold text-cidash-primary">(you)</span>}
                    </span>
                    <span className="text-xs text-subtle">{e.totalDistanceKm} km</span>
                  </span>
                  <span className="text-right text-sm font-bold">
                    {e.rankPoints.toLocaleString('en-US')} <span className="text-xs font-medium text-subtle">RP</span>
                  </span>
                </li>
              );
            })}
          </ol>
        </Card>
      </section>
    </div>
  );
}
