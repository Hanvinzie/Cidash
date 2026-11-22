import { useCallback, useEffect, useState } from 'react';

/** Key terpisah dari `cidash_theme`: ilustrasi Home tidak mengubah palette warna aplikasi. */
export const HOME_THEME_STORAGE_KEY = 'cidash_home_theme';
export const DEFAULT_HOME_THEME: HomeThemeId = 'vice-sunset';
export type HomeThemeId = 'vice-sunset' | 'ascii-meadow' | 'ascii-aurora' | 'none';

export interface HomeThemeOption {
  id: HomeThemeId;
  name: string;
  description: string;
}

export const HOME_THEMES: readonly HomeThemeOption[] = [
  { id: 'vice-sunset', name: 'Vice Sunset', description: 'Neon Florida sunset' },
  { id: 'ascii-meadow', name: 'Midnight Meadow', description: 'ASCII flower field' },
  { id: 'ascii-aurora', name: 'Cyber Aurora', description: 'ASCII northern lights' },
  { id: 'none', name: 'Original', description: 'No Home illustration' },
];

const EVENT = 'cidash:home-theme';

export function isHomeThemeId(value: unknown): value is HomeThemeId {
  return typeof value === 'string' && HOME_THEMES.some((theme) => theme.id === value);
}

export function readHomeTheme(): HomeThemeId {
  try {
    const saved = localStorage.getItem(HOME_THEME_STORAGE_KEY);
    return isHomeThemeId(saved) ? saved : DEFAULT_HOME_THEME;
  } catch {
    return DEFAULT_HOME_THEME;
  }
}

/** Preferensi latar Home. Default selalu Vice Sunset pada perangkat yang belum pernah menyimpan pilihan. */
export function useHomeTheme() {
  const [homeTheme, setHomeThemeState] = useState<HomeThemeId>(readHomeTheme);

  useEffect(() => {
    const sync = () => setHomeThemeState(readHomeTheme());
    window.addEventListener('storage', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('storage', sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);

  const setHomeTheme = useCallback((next: HomeThemeId) => {
    try {
      localStorage.setItem(HOME_THEME_STORAGE_KEY, next);
    } catch {
      /* Private mode/storage penuh: state tab ini tetap berubah. */
    }
    setHomeThemeState(next);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { homeTheme, setHomeTheme };
}
