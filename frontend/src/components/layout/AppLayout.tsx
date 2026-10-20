import { NavLink, Outlet } from 'react-router-dom';
import { profileTopUp, ROUTES } from '../../routes';
import { useApp } from '../../store/AppContext';
import Icon, { type IconName } from '../ui/Icon';
import ThemeToggle from '../ui/ThemeToggle';

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: ROUTES.dashboard, label: 'Home', icon: 'home' },
  { to: ROUTES.customQuest, label: 'Quests', icon: 'bomb' },
  { to: ROUTES.activity, label: 'Activity', icon: 'activity' },
  { to: ROUTES.profile, label: 'Profile', icon: 'user' },
];

export default function AppLayout() {
  const { user } = useApp();

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      {/* Top app bar */}
      <header className="sticky top-0 z-20 border-b border-line/70 bg-canvas/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
          <NavLink to={ROUTES.dashboard} className="flex items-center gap-2 rounded-lg" aria-label="Cidash home">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cidash-primary text-base font-extrabold text-cidash-on-primary">
              C
            </span>
            <span className="text-lg font-extrabold tracking-tight">Cidash</span>
          </NavLink>
          <div className="flex items-center gap-2">
            <NavLink
              to={profileTopUp}
              aria-label={`${user.coins} coins — top up`}
              className="flex items-center gap-1 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-bold text-warning transition hover:bg-warning/25"
            >
              <Icon name="coin" size={14} />
              {user.coins}
            </NavLink>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-md flex-1 px-4 pb-28 pt-5">
        <Outlet />
      </main>

      {/* Bottom navigation: icon + small label */}
      <nav
        aria-label="Main navigation"
        className="pb-safe fixed inset-x-0 bottom-0 z-20 border-t border-line/70 bg-surface/95 shadow-nav backdrop-blur-md"
      >
        <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `group flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors ${
                    isActive ? 'text-cidash-primary' : 'text-subtle hover:text-ink'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-8 w-14 items-center justify-center rounded-full transition-colors ${
                        isActive ? 'bg-cidash-primary/10' : 'group-hover:bg-inset'
                      }`}
                    >
                      <Icon name={item.icon} size={22} strokeWidth={isActive ? 2.3 : 1.9} />
                    </span>
                    <span>{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
