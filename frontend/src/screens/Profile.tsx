import { Suspense, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import CoinBalance from '../components/ui/CoinBalance';
import Icon from '../components/ui/Icon';
import SectionTitle from '../components/ui/SectionTitle';
import HistoryModal from '../components/activity/HistoryModal';
import SettingsModal from '../components/settings/SettingsModal';
import { ShareCardModal } from '../lazyScreens';
import { coinPackages } from '../data/mock';
import { useAppUpdate } from '../lib/appUpdate';
import { useApp } from '../store/AppContext';
import { circleOnboarding, ROUTES } from '../routes';
import CircleMembersSheet from '../components/circle/CircleMembersSheet';
import type { ActivityLog, Circle } from '../types';

export default function Profile() {
  const { user, circles, activeCircle, setActiveCircle, activityHistory, topUp, logout } = useApp();
  const { updateAvailable } = useAppUpdate();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [shareLog, setShareLog] = useState<ActivityLog | null>(null);
  const [membersCircle, setMembersCircle] = useState<Circle | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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

      {/* Riwayat: daftar lengkap ada di dalam modal agar halaman tidak memanjang */}
      <button type="button" onClick={() => setHistoryOpen(true)} className="block w-full text-left" aria-haspopup="dialog">
        <Card className="flex items-center gap-3 p-4 transition active:scale-[0.99]">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cidash-primary/10 text-cidash-primary">
            <Icon name="history" size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Activity history</span>
            <span className="block text-xs text-subtle">
              {activityHistory.length === 0
                ? 'No workouts yet'
                : `${activityHistory.length} ${activityHistory.length === 1 ? 'workout' : 'workouts'} · ${totalKm.toFixed(1)} km`}
            </span>
          </span>
          <Icon name="chevronRight" size={18} className="text-subtle" />
        </Card>
      </button>

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

      {/* Semua pengaturan (tema, notifikasi, lokasi, profil, About) ada di modal ini */}
      <button type="button" onClick={() => setSettingsOpen(true)} className="block w-full text-left" aria-haspopup="dialog">
        <Card className="flex items-center gap-3 p-4 transition active:scale-[0.99]">
          <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-inset text-muted">
            <Icon name="settings" size={20} />
            {updateAvailable && (
              <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-cidash-primary ring-2 ring-surface" aria-label="Update available" />
            )}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-bold">Settings</span>
            <span className="block text-xs text-subtle">{updateAvailable ? 'Update available' : 'Appearance, notifications, about'}</span>
          </span>
          <Icon name="chevronRight" size={18} className="text-subtle" />
        </Card>
      </button>

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

      {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

      {historyOpen && (
        <HistoryModal logs={activityHistory} onClose={() => setHistoryOpen(false)} onShare={(log) => setShareLog(log)} />
      )}

      {shareLog && (
        <Suspense fallback={null}>
          <ShareCardModal log={shareLog} username={user.username} onClose={() => setShareLog(null)} />
        </Suspense>
      )}
    </div>
  );
}
