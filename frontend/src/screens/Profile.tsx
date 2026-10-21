import { FormEvent, Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import CoinBalance from '../components/ui/CoinBalance';
import Icon, { type IconName } from '../components/ui/Icon';
import Modal from '../components/ui/Modal';
import SectionTitle from '../components/ui/SectionTitle';
import { Input, Segmented } from '../components/ui/Field';
import RouteSvg from '../components/share/RouteSvg';
import { ShareCardModal } from '../lazyScreens';
import { coinPackages } from '../data/mock';
import { formatDuration } from '../lib/geo';
import { useApp } from '../store/AppContext';
import { useTheme, type ThemePreference } from '../store/ThemeContext';
import { circleOnboarding, ROUTES } from '../routes';
import CircleMembersSheet from '../components/circle/CircleMembersSheet';
import type { ActivityLog, Circle } from '../types';

type SettingKey = 'edit' | 'notifications' | 'privacy' | 'help';

const SETTINGS: { key: SettingKey; label: string; icon: IconName }[] = [
  { key: 'edit', label: 'Edit profile', icon: 'edit' },
  { key: 'notifications', label: 'Notifications', icon: 'bell' },
  { key: 'privacy', label: 'Privacy & security', icon: 'shield' },
  { key: 'help', label: 'Help & rules', icon: 'help' },
];

export default function Profile() {
  const { user, circles, activeCircle, setActiveCircle, activityHistory, topUp, updateProfileName, logout } = useApp();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [shareLog, setShareLog] = useState<ActivityLog | null>(null);
  const [membersCircle, setMembersCircle] = useState<Circle | null>(null);
  const [activeSetting, setActiveSetting] = useState<SettingKey | null>(null);
  const [nameInput, setNameInput] = useState(user.username);
  const [notifBomb, setNotifBomb] = useState(() => localStorage.getItem('cidash_notif_bomb') !== '0');
  const [notifGroup, setNotifGroup] = useState(() => localStorage.getItem('cidash_notif_group') !== '0');
  const showTopUp = params.get('topup') === '1';

  const totalKm = activityHistory.reduce((sum, a) => sum + a.distanceKm, 0);
  const shieldCount = user.shieldTickets ?? 0;

  // Top-up panel state lives in the URL so other screens can deep-link to it.
  const toggleTopUp = () => setParams(showTopUp ? {} : { topup: '1' }, { replace: true });

  function handleBuy(coins: number) {
    topUp(coins); // Demo mode top-up
    setParams({}, { replace: true });
  }

  function handleOpenCircle(id: string) {
    setActiveCircle(id);
    navigate(ROUTES.dashboard);
  }

  function handleLogout() {
    logout();
    navigate(ROUTES.login, { replace: true });
  }

  function handleSaveProfile(e: FormEvent, close: () => void) {
    e.preventDefault();
    updateProfileName(nameInput);
    close();
  }

  return (
    <div className="space-y-7">
      {/* Identity */}
      <Card className="p-5">
        <div className="flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-cidash-primary text-2xl font-extrabold uppercase text-cidash-on-primary ring-4 ring-cidash-primary/15"
            aria-hidden
          >
            {user.username.charAt(0)}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-extrabold">@{user.username}</h1>
            <p className="truncate text-xs text-subtle">{user.email ?? `ID: ${user.id}`}</p>
          </div>
          <Badge tone="primary">
            <Icon name="shield" size={13} /> {shieldCount} {shieldCount === 1 ? 'Shield' : 'Shields'}
          </Badge>
        </div>
        <dl className="mt-4 grid grid-cols-3 divide-x divide-line rounded-xl bg-inset py-3 text-center">
          {[
            { label: 'Rank Points', value: user.rankPoints.toLocaleString('en-US') },
            { label: 'Activities', value: activityHistory.length },
            { label: 'Total km', value: totalKm.toFixed(1) },
          ].map((s) => (
            <div key={s.label} className="flex flex-col-reverse">
              <dt className="text-[11px] font-medium text-subtle">{s.label}</dt>
              <dd className="text-lg font-extrabold">{s.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {/* Wallet */}
      <section>
        <SectionTitle>Wallet</SectionTitle>
        <CoinBalance coins={user.coins} onTopUp={toggleTopUp} topUpLabel={showTopUp ? 'Close' : 'Top up'} />
        {showTopUp && (
          <Card className="mt-3 space-y-2">
            <p className="text-xs font-semibold text-muted">Choose a package (Demo instant top-up)</p>
            {coinPackages.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleBuy(p.coins + (p.bonusCoins ?? 0))}
                className="flex w-full items-center justify-between rounded-xl border border-line bg-inset px-4 py-3 text-left transition hover:border-cidash-primary active:scale-[0.98]"
              >
                <span className="flex items-center gap-2">
                  <Icon name="coin" size={18} className="text-warning" />
                  <span className="font-bold">{p.coins} coins</span>
                  {p.bonusCoins && <Badge tone="success">+{p.bonusCoins} bonus</Badge>}
                </span>
                <span className="text-sm font-bold text-cidash-primary">{p.priceLabel}</span>
              </button>
            ))}
          </Card>
        )}
      </section>

      {/* History & route gallery */}
      <section>
        <SectionTitle>Activity history</SectionTitle>
        {activityHistory.length === 0 ? (
          <Card className="py-8 text-center text-sm text-subtle">No recorded workouts yet.</Card>
        ) : (
          <ul className="space-y-3">
            {activityHistory.map((a) => (
              <li key={a.id}>
                <Card className="flex items-center gap-3 p-3">
                  <RouteSvg
                    points={a.route}
                    width={64}
                    height={64}
                    strokeWidth={3}
                    padding={6}
                    className="h-14 w-14 shrink-0 rounded-xl bg-cidash-primary/5 text-subtle"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">
                      {a.type === 'run' ? 'Run' : 'Ride'} · {a.distanceKm} km
                    </p>
                    <p className="truncate text-xs text-subtle">
                      {a.date} · {formatDuration(a.durationSec)}
                    </p>
                    <div className="mt-1">
                      <StatusBadge status={a.missionStatus} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShareLog(a)}
                    aria-label={`Share ${a.distanceKm} km ${a.type === 'run' ? 'run' : 'ride'}`}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary transition hover:bg-cidash-primary/20 active:scale-90"
                  >
                    <Icon name="share" size={18} />
                  </button>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Circles */}
      <section>
        <SectionTitle
          action={
            <button
              type="button"
              onClick={() => navigate(circleOnboarding)}
              className="flex items-center gap-1 text-xs font-semibold text-cidash-primary"
            >
              <Icon name="plus" size={14} /> Create / join
            </button>
          }
        >
          My circles
        </SectionTitle>
        {circles.length === 0 ? (
          <Card className="py-8 text-center text-sm text-subtle">You haven't joined any circles yet.</Card>
        ) : (
          <Card className="p-0">
            <ul className="divide-y divide-line/70">
              {circles.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setMembersCircle(c)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-inset active:bg-inset"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
                      <Icon name="users" size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        <span className="truncate">{c.name}</span>
                        {c.id === activeCircle?.id && <Badge tone="primary">Active</Badge>}
                      </span>
                      <span className="text-xs text-subtle">{c.memberCount} members</span>
                    </span>
                    <span className="font-mono text-xs font-bold tracking-widest text-muted">{c.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>

      {/* Settings (incl. appearance) */}
      <section>
        <SectionTitle>Settings</SectionTitle>
        <Card className="p-0">
          <div className="border-b border-line/70 p-3">
            <p className="mb-2 px-1 text-xs font-semibold text-muted">Appearance</p>
            <Segmented<ThemePreference>
              ariaLabel="Theme"
              value={preference}
              onChange={setPreference}
              options={[
                {
                  value: 'light',
                  label: (
                    <>
                      <Icon name="sun" size={16} /> Light
                    </>
                  ),
                },
                {
                  value: 'dark',
                  label: (
                    <>
                      <Icon name="moon" size={16} /> Dark
                    </>
                  ),
                },
                {
                  value: 'system',
                  label: (
                    <>
                      <Icon name="monitor" size={16} /> Auto
                    </>
                  ),
                },
              ]}
            />
          </div>
          <ul className="divide-y divide-line/70">
            {SETTINGS.map((item) => (
              <li key={item.key}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.key === 'edit') setNameInput(user.username);
                    setActiveSetting(item.key);
                  }}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium transition hover:bg-inset"
                >
                  <Icon name={item.icon} size={18} className="text-muted" />
                  <span className="flex-1">{item.label}</span>
                  <Icon name="chevronRight" size={16} className="text-subtle" />
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <Button variant="danger" fullWidth onClick={handleLogout}>
        <Icon name="logout" size={18} /> Sign out
      </Button>

      {membersCircle && (
        <CircleMembersSheet
          circle={membersCircle}
          onClose={() => setMembersCircle(null)}
          onOpenCircle={() => {
            setMembersCircle(null);
            handleOpenCircle(membersCircle.id);
          }}
        />
      )}

      {activeSetting === 'edit' && (
        <Modal title="Edit profile" onClose={() => setActiveSetting(null)}>
          {(close) => (
            <form onSubmit={(e) => handleSaveProfile(e, () => close())} className="space-y-4">
              <Input
                label="Display name"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                minLength={2}
                maxLength={60}
                required
              />
              <Button type="submit" fullWidth disabled={nameInput.trim().length < 2}>
                Save changes
              </Button>
            </form>
          )}
        </Modal>
      )}

      {activeSetting === 'notifications' && (
        <Modal title="Notifications" onClose={() => setActiveSetting(null)}>
          {(close) => (
            <div className="space-y-4">
              <label className="flex items-center justify-between text-sm">
                <span>
                  <span className="block font-semibold">Bomb Mission alerts</span>
                  <span className="text-xs text-subtle">When a friend sends or completes a dare</span>
                </span>
                <input
                  type="checkbox"
                  checked={notifBomb}
                  onChange={(e) => {
                    setNotifBomb(e.target.checked);
                    localStorage.setItem('cidash_notif_bomb', e.target.checked ? '1' : '0');
                  }}
                  className="h-5 w-5 accent-cidash-primary"
                />
              </label>
              <label className="flex items-center justify-between text-sm">
                <span>
                  <span className="block font-semibold">Live Group Run invites</span>
                  <span className="text-xs text-subtle">When a circle member starts a live lobby</span>
                </span>
                <input
                  type="checkbox"
                  checked={notifGroup}
                  onChange={(e) => {
                    setNotifGroup(e.target.checked);
                    localStorage.setItem('cidash_notif_group', e.target.checked ? '1' : '0');
                  }}
                  className="h-5 w-5 accent-cidash-primary"
                />
              </label>
              <Button fullWidth onClick={() => close()}>
                Done
              </Button>
            </div>
          )}
        </Modal>
      )}

      {activeSetting === 'privacy' && (
        <Modal title="Privacy & security" onClose={() => setActiveSetting(null)}>
          {(close) => (
            <div className="space-y-3 text-sm text-muted">
              <p>
                <b>Invite-only Circles:</b> Only members with your 8-character circle code can view the circle leaderboard or send Bomb Missions.
              </p>
              <p>
                <b>Email Privacy:</b> Your email address is never exposed to other circle members.
              </p>
              <p>
                <b>Anti-Cheat Verification:</b> Every workout is verified on the server using Haversine coordinate continuity and speed limits to keep leaderboards fair.
              </p>
              <Button fullWidth onClick={() => close()} className="mt-2">
                Got it
              </Button>
            </div>
          )}
        </Modal>
      )}

      {activeSetting === 'help' && (
        <Modal title="How Cidash works" onClose={() => setActiveSetting(null)}>
          {(close) => (
            <div className="space-y-3 text-sm text-muted">
              <p>
                <b>Rank Points (RP):</b> Earn 10 RP per kilometer on every verified run or ride, plus bonus stakes from completing Bomb Missions.
              </p>
              <p>
                <b>Bomb Missions:</b> Spend coins to challenge a circle friend with a distance & time goal. If they succeed, they win the stakes RP; if they fail or expire, you win the RP!
              </p>
              <p>
                <b>Shield Tickets:</b> Use a Shield Ticket to neutralize an incoming Bomb Mission without losing any Rank Points.
              </p>
              <Button fullWidth onClick={() => close()} className="mt-2">
                Close
              </Button>
            </div>
          )}
        </Modal>
      )}

      {shareLog && (
        <Suspense fallback={null}>
          <ShareCardModal log={shareLog} username={user.username} onClose={() => setShareLog(null)} />
        </Suspense>
      )}
    </div>
  );
}
