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

/**
 * Tautan undangan circle: `https://<host>/join?code=ABCD1234`. Dibuka user yang sudah login = langsung bergabung;
 * belum login = diarahkan masuk/daftar dulu dengan kode terisi otomatis (lihat screens/Join.tsx).
 */
export const joinLink = (code: string) => `${window.location.origin}${ROUTES.join}?code=${encodeURIComponent(code)}`;
