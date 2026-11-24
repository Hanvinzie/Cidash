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

/** Host canonical (tanpa protokol) — ditampilkan di prompt izin lokasi & teks pemasangan PWA. */
export const PUBLIC_APP_HOST = (() => {
  try {
    return new URL(PUBLIC_APP_URL).host;
  } catch {
    return new URL(DEFAULT_PUBLIC_APP_URL).host;
  }
})();

/** Halaman Home (Dashboard) — tujuan default saat aplikasi dibuka atau sesudah autentikasi. */
export const DEFAULT_ROUTE = ROUTES.dashboard;

/**
 * Sanitasi tujuan setelah login. Profile bukan tujuan default: tautan lama yang menyimpan
 * `/profile` (mis. sesi kedaluwarsa saat di tab Profile) dikembalikan ke Home agar membuka
 * kembali aplikasi selalu mendarat di Homescreen, bukan Profile.
 */
export function safeRedirect(from?: string | null): string {
  if (!from || !from.startsWith('/')) return DEFAULT_ROUTE;
  const path = from.split(/[?#]/, 1)[0];
  if (path === ROUTES.profile || path === ROUTES.login || path === ROUTES.join) return DEFAULT_ROUTE;
  return from;
}

/**
 * Tautan undangan circle: `https://cidash.hanvinzie.com/join?code=ABCD1234`. Dibuka user yang sudah login = langsung bergabung;
 * belum login = diarahkan masuk/daftar dulu dengan kode terisi otomatis (lihat screens/Join.tsx).
 */
export const joinLink = (code: string) => `${PUBLIC_APP_URL}${ROUTES.join}?code=${encodeURIComponent(code)}`;
