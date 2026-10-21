import { Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge, { StatusBadge } from '../components/ui/Badge';
import CoinBalance from '../components/ui/CoinBalance';
import Icon, { type IconName } from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import { Segmented } from '../components/ui/Field';
import RouteSvg from '../components/share/RouteSvg';
import { ShareCardModal } from '../lazyScreens';
import { coinPackages } from '../data/mock';
import { formatDuration } from '../lib/geo';
import { useApp } from '../store/AppContext';
import { useTheme, type ThemePreference } from '../store/ThemeContext';
import { circleOnboarding, ROUTES } from '../routes';
import type { ActivityLog } from '../types';

const SETTINGS: { label: string; icon: IconName }[] = [
  { label: 'Edit profile', icon: 'edit' },
  { label: 'Notifications', icon: 'bell' },
  { label: 'Privacy & security', icon: 'shield' },
  { label: 'Help', icon: 'help' },
];

export default function Profile() {
  const { user, circles, activeCircle, setActiveCircle, activityHistory, topUp, logout } = useApp();
  const { preference, setPreference } = useTheme();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [shareLog, setShareLog] = useState<ActivityLog | null>(null);
  const showTopUp = params.get('topup') === '1';

  const totalKm = activityHistory.reduce((sum, a) => sum + a.distanceKm, 0);

  // Top-up panel state lives in the URL so other screens can deep-link to it.
  const toggleTopUp = () => setParams(showTopUp ? {} : { topup: '1' }, { replace: true });

  function handleBuy(coins: number) {
    topUp(coins); // TODO: buat transaksi Payment Gateway, koin masuk via webhook
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
          <div className="min-w-0">
            <h1 className="truncate text-xl font-extrabold">@{user.username}</h1>
            <p className="text-xs text-subtle">ID: {user.id}</p>
          </div>
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
            <p className="text-xs font-semibold text-muted">Choose a package (paid via payment gateway)</p>
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
        <Card className="p-0">
          <ul className="divide-y divide-line/70">
            {circles.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => handleOpenCircle(c.id)}
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
                { value: 'light', label: <><Icon name="sun" size={16} /> Light</> },
                { value: 'dark', label: <><Icon name="moon" size={16} /> Dark</> },
                { value: 'system', label: <><Icon name="monitor" size={16} /> Auto</> },
              ]}
            />
          </div>
          <ul className="divide-y divide-line/70">
            {SETTINGS.map((item) => (
              <li key={item.label}>
                {/* TODO: halaman detail pengaturan */}
                <button
                  type="button"
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

      {shareLog && (
        <Suspense fallback={null}>
          <ShareCardModal log={shareLog} username={user.username} onClose={() => setShareLog(null)} />
        </Suspense>
      )}
    </div>
  );
}
