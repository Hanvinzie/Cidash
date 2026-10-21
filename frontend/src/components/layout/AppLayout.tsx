import { Suspense, useLayoutEffect, useRef } from 'react';
import type { CSSProperties } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { profileTopUp, ROUTES } from '../../routes';
import { useApp } from '../../store/AppContext';
import { RunSessionProvider, useIsRecording } from '../../store/RunSession';
import HideBoot from '../routing/HideBoot';
import Icon, { type IconName } from '../ui/Icon';
import RunnerLoader from '../ui/RunnerLoader';
import ThemeToggle from '../ui/ThemeToggle';

const navItems: { to: string; label: string; icon: IconName }[] = [
  { to: ROUTES.dashboard, label: 'Home', icon: 'home' },
  { to: ROUTES.customQuest, label: 'Quests', icon: 'bomb' },
  { to: ROUTES.activity, label: 'Activity', icon: 'activity' },
  { to: ROUTES.profile, label: 'Profile', icon: 'user' },
];

/** Titik merah berdenyut di tab Activity saat lari sedang direkam di tab lain. */
function RecordingDot() {
  const recording = useIsRecording();
  if (!recording) return null;
  return (
    <span className="absolute -right-1 -top-0.5 flex h-2.5 w-2.5" aria-label="Recording">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cidash-primary opacity-60" />
      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cidash-primary ring-2 ring-surface" />
    </span>
  );
}

const tabIndex = (path: string) => navItems.findIndex((n) => path.startsWith(n.to));

/**
 * App shell native: header & bottom nav diam, hanya <main> yang scroll.
 * Layout tidak pernah di-unmount saat pindah tab, dan posisi scroll tiap tab diingat.
 */
export default function AppLayout() {
  const { user } = useApp();
  const { pathname } = useLocation();
  const scrollRef = useRef<HTMLElement>(null);
  const scrollPos = useRef(new Map<string, number>());
  const prevPath = useRef(pathname);
  const dir = Math.sign(tabIndex(pathname) - tabIndex(prevPath.current));

  // Simpan posisi scroll tab lama, pulihkan posisi tab baru.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = scrollPos.current.get(pathname) ?? 0;
    prevPath.current = pathname;
    const onScroll = () => scrollPos.current.set(pathname, el.scrollTop);
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [pathname]);

  /** Tap tab yang sedang aktif = scroll ke atas (pola native iOS/Android). */
  const handleNavClick = (to: string) => {
    // Simpan posisi tab sekarang sebelum pindah (event scroll bisa belum terkirim).
    if (scrollRef.current) scrollPos.current.set(pathname, scrollRef.current.scrollTop);
    if (pathname.startsWith(to)) scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <RunSessionProvider>
      <div className="flex h-full flex-col bg-canvas">
        {/* Top app bar */}
        <header className="pt-safe z-20 shrink-0 border-b border-line/70 bg-canvas/90 backdrop-blur-md">
          <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
            <NavLink
              to={ROUTES.dashboard}
              onClick={() => handleNavClick(ROUTES.dashboard)}
              className="flex items-center gap-2"
              aria-label="Cidash home"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-cidash-primary text-base font-extrabold text-cidash-on-primary">
                C
              </span>
              <span className="text-lg font-extrabold tracking-tight">Cidash</span>
            </NavLink>
            <div className="flex items-center gap-1">
              <NavLink
                to={profileTopUp}
                aria-label={`${user.coins} coins — top up`}
                className="flex h-9 items-center gap-1 rounded-full px-2.5 text-sm font-bold text-warning transition active:scale-95"
              >
                <Icon name="coin" size={16} />
                {user.coins}
              </NavLink>
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="scroll-area flex-1">
          <div
            key={pathname}
            className="animate-page mx-auto w-full max-w-md px-4 pb-8 pt-5"
            style={{ '--page-dir': dir } as CSSProperties}
          >
            <Suspense
              fallback={
                <div className="flex justify-center pt-24">
                  <RunnerLoader />
                </div>
              }
            >
              <HideBoot />
              <Outlet />
            </Suspense>
          </div>
        </main>

        {/* Bottom navigation: icon + small label */}
        <nav aria-label="Main navigation" className="pb-safe z-20 shrink-0 border-t border-line/70 bg-surface">
          <ul className="mx-auto grid h-16 max-w-md grid-cols-4">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={() => handleNavClick(item.to)}
                  className={({ isActive }) =>
                    `flex h-full flex-col items-center justify-center gap-1 text-[11px] font-semibold transition-colors active:scale-90 ${
                      isActive ? 'text-cidash-primary' : 'text-subtle'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative">
                        <Icon name={item.icon} size={24} strokeWidth={isActive ? 2.4 : 1.9} />
                        {item.to === ROUTES.activity && <RecordingDot />}
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
    </RunSessionProvider>
  );
}
