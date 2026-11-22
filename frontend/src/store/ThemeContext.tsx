import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { DEFAULT_THEME_ID, resolveThemeId } from '../lib/themes';

/** Mode terang/gelap. Terpisah dari tema (palet): setiap tema menyediakan keduanya. */
export type ThemePreference = 'light' | 'dark' | 'system';

const MODE_KEY = 'cidash_theme';
const THEME_ID_KEY = 'cidash_theme_id';
/** Cadangan bila token belum bisa dibaca. Nilai sebenarnya diambil dari --c-canvas tema aktif. */
const FALLBACK_THEME_COLOR = { light: '#F6F6F8', dark: '#0B0F17' } as const;

interface ThemeState {
  /** Mode yang dipilih user: light, dark, atau system (ikuti OS). */
  preference: ThemePreference;
  /** Mode yang benar-benar aktif. */
  resolved: 'light' | 'dark';
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
  /** Id tema (palet) aktif, lihat lib/themes.ts. */
  themeId: string;
  setThemeId: (id: string) => void;
}

const ThemeContext = createContext<ThemeState | null>(null);

const systemPrefersDark = () => window.matchMedia('(prefers-color-scheme: dark)').matches;

function readPreference(): ThemePreference {
  const saved = localStorage.getItem(MODE_KEY);
  return saved === 'light' || saved === 'dark' ? saved : 'system';
}

function readThemeId(): string {
  try {
    return resolveThemeId(localStorage.getItem(THEME_ID_KEY));
  } catch {
    return DEFAULT_THEME_ID;
  }
}

/** Warna latar (--c-canvas, "R G B") tema aktif sebagai hex untuk <meta name="theme-color">. */
function canvasHex(fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--c-canvas').trim();
  const rgb = raw.split(/\s+/).map(Number);
  if (rgb.length !== 3 || rgb.some((n) => !Number.isFinite(n))) return fallback;
  return `#${rgb.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

/** Terapkan `data-theme` + class `dark` di <html>, lalu samakan warna status bar browser/PWA dengan latar tema. */
function applyTheme(resolved: 'light' | 'dark', themeId: string) {
  const root = document.documentElement;
  root.dataset.theme = themeId;
  root.classList.toggle('dark', resolved === 'dark');
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', canvasHex(FALLBACK_THEME_COLOR[resolved]));
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(readPreference);
  const [themeId, setThemeIdState] = useState<string>(readThemeId);
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  // Ikuti perubahan tema OS saat preferensi = system.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolved = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;

  useEffect(() => applyTheme(resolved, themeId), [resolved, themeId]);

  const setPreference = useCallback((p: ThemePreference) => {
    if (p === 'system') localStorage.removeItem(MODE_KEY);
    else localStorage.setItem(MODE_KEY, p);
    setPreferenceState(p);
  }, []);

  const setThemeId = useCallback((id: string) => {
    const next = resolveThemeId(id);
    if (next === DEFAULT_THEME_ID) localStorage.removeItem(THEME_ID_KEY);
    else localStorage.setItem(THEME_ID_KEY, next);
    setThemeIdState(next);
  }, []);

  const toggle = useCallback(() => setPreference(resolved === 'dark' ? 'light' : 'dark'), [resolved, setPreference]);

  return (
    <ThemeContext.Provider value={{ preference, resolved, setPreference, toggle, themeId, setThemeId }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeState {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
