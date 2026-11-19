// Info kontributor untuk halaman About. Mengambil dari repo UPSTREAM (bukan fork), karena fork hanya
// menampilkan daftar yang sama dengan upstream atau lebih sedikit.

export const GITHUB_REPO = import.meta.env.VITE_GITHUB_REPO?.trim() || 'N11ch/Cidash';
export const GITHUB_URL = `https://github.com/${GITHUB_REPO}`;

export interface Contributor {
  login: string;
  avatarUrl: string;
  profileUrl: string;
  contributions: number;
  /** Pemilik repo upstream = pembuat aplikasi. */
  isCreator: boolean;
}

interface Cached {
  at: number;
  repo: string;
  contributors: Contributor[];
}

const CACHE_KEY = 'cidash_contributors_v1';
/** Batas API GitHub tanpa token: 60 request/jam/IP, jadi hasilnya di-cache. */
const FRESH_MS = 6 * 60 * 60_000;
const TIMEOUT_MS = 8000;

function readCache(): Cached | null {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null') as Cached | null;
    return c && c.repo === GITHUB_REPO && Array.isArray(c.contributors) ? c : null;
  } catch {
    return null;
  }
}

async function getJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}${path}`, {
      signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub ${res.status}`);
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Daftar kontributor (pembuat di urutan pertama, lalu terbanyak). Memakai cache 6 jam; bila GitHub
 * gagal/rate-limit, cache lama tetap dipakai (`stale: true`). Melempar hanya bila tidak ada data sama sekali.
 */
export async function fetchContributors(force = false): Promise<{ contributors: Contributor[]; stale: boolean }> {
  const cached = readCache();
  if (cached && !force && Date.now() - cached.at < FRESH_MS) return { contributors: cached.contributors, stale: false };

  try {
    const [repo, list] = await Promise.all([
      getJson<{ owner: { login: string } }>(''),
      getJson<{ login: string; avatar_url: string; html_url: string; contributions: number; type: string }[]>(
        '/contributors?per_page=30',
      ),
    ]);
    const owner = repo.owner.login.toLowerCase();
    const contributors = list
      .filter((c) => c.type !== 'Bot' && !c.login.endsWith('[bot]'))
      .map<Contributor>((c) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        profileUrl: c.html_url,
        contributions: c.contributions,
        isCreator: c.login.toLowerCase() === owner,
      }))
      .sort((a, b) => Number(b.isCreator) - Number(a.isCreator) || b.contributions - a.contributions);
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), repo: GITHUB_REPO, contributors } satisfies Cached));
    } catch {
      /* storage penuh — cache hanya optimasi */
    }
    return { contributors, stale: false };
  } catch (e) {
    if (cached) return { contributors: cached.contributors, stale: true };
    throw e;
  }
}
