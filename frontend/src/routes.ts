// Satu sumber kebenaran untuk path & deep-link antar-halaman.
export const ROUTES = {
  login: '/login',
  dashboard: '/dashboard',
  customQuest: '/custom-quest',
  activity: '/activity',
  profile: '/profile',
  join: '/join',
} as const;

/** Buka Activity dengan misi terpilih otomatis. */
export const activityFor = (missionId: string) =>
  `${ROUTES.activity}?mission=${encodeURIComponent(missionId)}`;

/** Buka Profile dengan panel Top Up terbuka. */
export const profileTopUp = `${ROUTES.profile}?topup=1`;

/** Buka langkah onboarding circle (create/join) untuk user yang sudah login. */
export const circleOnboarding = `${ROUTES.login}?step=circle`;

/** Buka Activity dalam mode Group Run; dengan roomId = langsung gabung room. */
export const groupRunFor = (roomId?: string) =>
  `${ROUTES.activity}?mode=group${roomId ? `&room=${encodeURIComponent(roomId)}` : ''}`;

const DEFAULT_PUBLIC_APP_URL = 'https://cidash.hanvinzie.com';

/** Domain publik utama aplikasi untuk tautan undangan (env VITE_PUBLIC_APP_URL dengan fallback cidash.hanvinzie.com). */
export const PUBLIC_APP_URL = (import.meta.env.VITE_PUBLIC_APP_URL?.trim() || DEFAULT_PUBLIC_APP_URL).replace(/\/+$/, '');

/**
 * Tautan undangan circle: `https://cidash.hanvinzie.com/join?code=ABCD1234`. Dibuka user yang sudah login = langsung bergabung;
 * belum login = diarahkan masuk/daftar dulu dengan kode terisi otomatis (lihat screens/Join.tsx).
 */
export const joinLink = (code: string) => `${PUBLIC_APP_URL}${ROUTES.join}?code=${encodeURIComponent(code)}`;
