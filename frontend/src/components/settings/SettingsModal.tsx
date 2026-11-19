import { FormEvent, useState } from 'react';
import Button from '../ui/Button';
import { Input, Segmented } from '../ui/Field';
import Icon, { type IconName } from '../ui/Icon';
import Modal from '../ui/Modal';
import Toggle from '../ui/Toggle';
import AboutPanel from './AboutPanel';
import { useAppUpdate } from '../../lib/appUpdate';
import { SETTING_KEYS, useBooleanSetting } from '../../lib/settings';
import { useApp } from '../../store/AppContext';
import { useTheme, type ThemePreference } from '../../store/ThemeContext';

type Page = 'root' | 'appearance' | 'notifications' | 'activity' | 'edit' | 'privacy' | 'help' | 'about';

const ROWS: { page: Exclude<Page, 'root'>; label: string; icon: IconName }[] = [
  { page: 'appearance', label: 'Appearance', icon: 'sun' },
  { page: 'notifications', label: 'Notifications', icon: 'bell' },
  { page: 'activity', label: 'Activity & location', icon: 'locate' },
  { page: 'edit', label: 'Edit profile', icon: 'edit' },
  { page: 'privacy', label: 'Privacy & security', icon: 'shield' },
  { page: 'help', label: 'Help & rules', icon: 'help' },
  { page: 'about', label: 'About Cidash', icon: 'info' },
];

const TITLES: Record<Page, string> = {
  root: 'Settings',
  appearance: 'Appearance',
  notifications: 'Notifications',
  activity: 'Activity & location',
  edit: 'Edit profile',
  privacy: 'Privacy & security',
  help: 'How Cidash works',
  about: 'About',
};

const THEME_LABEL: Record<ThemePreference, string> = { light: 'Light', dark: 'Dark', system: 'Auto' };

/**
 * Semua pengaturan pengguna (tema, notifikasi, lokasi, profil, About) ada di sini, di dalam modal Profile.
 * Setiap layar hanya menampilkan satu keputusan; tombol kembali ada di kiri atas.
 */
export default function SettingsModal({ onClose }: { onClose: () => void }) {
  const [page, setPage] = useState<Page>('root');
  return (
    <Modal title={TITLES[page]} onClose={onClose} showTitle={page === 'root'}>
      {(close) => (
        <div>
          {page !== 'root' && (
            <div className="-mt-1 mb-3 flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPage('root')}
                aria-label="Back to settings"
                className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition active:scale-90 active:bg-inset"
              >
                <Icon name="chevronLeft" size={20} />
              </button>
              <h3 className="text-lg font-bold">{TITLES[page]}</h3>
            </div>
          )}
          {page === 'root' && <Root onOpen={setPage} />}
          {page === 'appearance' && <Appearance />}
          {page === 'notifications' && <Notifications />}
          {page === 'activity' && <ActivitySettings />}
          {page === 'edit' && <EditProfile onDone={() => close()} />}
          {page === 'privacy' && <Privacy onDone={() => setPage('root')} />}
          {page === 'help' && <Help onDone={() => setPage('root')} />}
          {page === 'about' && <AboutPanel />}
        </div>
      )}
    </Modal>
  );
}

function Root({ onOpen }: { onOpen: (p: Page) => void }) {
  const { preference } = useTheme();
  const { currentVersion, updateAvailable } = useAppUpdate();
  const hint: Partial<Record<Page, string>> = { appearance: THEME_LABEL[preference], about: `v${currentVersion}` };
  return (
    <ul className="max-h-[62dvh] divide-y divide-line/70 overflow-y-auto rounded-2xl bg-inset">
      {ROWS.map((row) => (
        <li key={row.page}>
          <button
            type="button"
            onClick={() => onOpen(row.page)}
            className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-sm font-semibold transition active:bg-line/50"
          >
            <Icon name={row.icon} size={18} className="text-muted" />
            <span className="flex-1">{row.label}</span>
            {row.page === 'about' && updateAvailable && (
              <span className="rounded-full bg-cidash-primary px-2 py-0.5 text-[10px] font-bold text-cidash-on-primary">
                Update
              </span>
            )}
            {hint[row.page] && <span className="text-xs font-medium text-subtle">{hint[row.page]}</span>}
            <Icon name="chevronRight" size={16} className="text-subtle" />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Appearance() {
  const { preference, setPreference } = useTheme();
  return (
    <div className="space-y-3">
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
      <p className="px-1 text-xs text-subtle">Auto follows your phone's appearance setting.</p>
    </div>
  );
}

function Notifications() {
  const [bomb, setBomb] = useBooleanSetting(SETTING_KEYS.notifyBomb, true);
  const [group, setGroup] = useBooleanSetting(SETTING_KEYS.notifyGroup, true);
  return (
    <div className="space-y-1">
      <Toggle checked={bomb} onChange={setBomb} label="Bomb Mission alerts" description="When a friend sends or completes a dare" />
      <Toggle checked={group} onChange={setGroup} label="Live Group Run invites" description="When a circle member starts a live lobby" />
    </div>
  );
}

function ActivitySettings() {
  const [liveShare, setLiveShare] = useBooleanSetting(SETTING_KEYS.liveShare, false);
  const [simulate, setSimulate] = useBooleanSetting(SETTING_KEYS.simulate, false);
  const [devMode, setDevMode] = useBooleanSetting(SETTING_KEYS.devMode, false);
  return (
    <div className="space-y-1">
      <Toggle
        checked={liveShare}
        onChange={setLiveShare}
        label="Share live location with my circle"
        description="Circle members see you on their map while you record. Group runs always share."
      />
      {/* Alat uji: hanya tampil setelah opsi pengembang dibuka (ketuk versi di About 7x). */}
      {devMode && (
        <>
          <Toggle
            checked={simulate}
            onChange={setSimulate}
            label="Simulated GPS (developer)"
            description="Run a recorded GBK loop instead of using the GPS"
          />
          <button
            type="button"
            onClick={() => {
              setSimulate(false);
              setDevMode(false);
            }}
            className="mt-1 text-xs font-semibold text-subtle underline"
          >
            Hide developer options
          </button>
        </>
      )}
    </div>
  );
}

function EditProfile({ onDone }: { onDone: () => void }) {
  const { user, updateProfileName } = useApp();
  const [name, setName] = useState(user.username);
  function submit(e: FormEvent) {
    e.preventDefault();
    updateProfileName(name);
    onDone();
  }
  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={60} required />
      <Button type="submit" fullWidth disabled={name.trim().length < 2}>
        Save changes
      </Button>
    </form>
  );
}

function Privacy({ onDone }: { onDone: () => void }) {
  return (
    <div className="space-y-3 text-sm text-muted">
      <p>
        <b>Invite-only Circles:</b> Only members with your 8-character circle code can view the circle leaderboard or send Bomb Missions.
      </p>
      <p>
        <b>Live location:</b> Off by default. When on, your position is broadcast to your circle only while you are recording, and is never saved.
      </p>
      <p>
        <b>Email Privacy:</b> Your email address is never exposed to other circle members.
      </p>
      <p>
        <b>Anti-Cheat Verification:</b> Every workout is verified on the server using Haversine coordinate continuity and speed limits to keep leaderboards fair.
      </p>
      <Button fullWidth onClick={onDone} className="mt-2">
        Got it
      </Button>
    </div>
  );
}

function Help({ onDone }: { onDone: () => void }) {
  return (
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
      <Button fullWidth onClick={onDone} className="mt-2">
        Close
      </Button>
    </div>
  );
}
