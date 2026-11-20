// ============================================================
// HTTP client untuk REST API NestJS (mendukung Vercel Serverless, Ngrok & Vite Proxy).
// ============================================================

const DEFAULT_API_PREFIX = '/api';

function normalizeBaseUrl(raw: string): string {
  const cleaned = raw.trim().replace(/\/+$/, '');
  if (!cleaned) return DEFAULT_API_PREFIX;
  if (cleaned === DEFAULT_API_PREFIX || cleaned.endsWith(DEFAULT_API_PREFIX)) {
    return cleaned;
  }
  return `${cleaned}${DEFAULT_API_PREFIX}`;
}

function resolveBaseUrl(): string {
  const configured = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (!configured) {
    return DEFAULT_API_PREFIX;
  }

  const pointsToLocal =
    configured.includes('localhost') || configured.includes('127.0.0.1');

  // Di production build (Vercel) atau saat diakses via tunnel/IP jaringan,
  // abaikan fallback localhost dan gunakan relative /api pada origin yang sama.
  if (import.meta.env.PROD && pointsToLocal) {
    return DEFAULT_API_PREFIX;
  }

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalBrowser = host === 'localhost' || host === '127.0.0.1';
    if (!isLocalBrowser && pointsToLocal) {
      return DEFAULT_API_PREFIX;
    }
  }

  return normalizeBaseUrl(configured);
}

const BASE_URL = resolveBaseUrl();
const TOKEN_KEY = 'cidash_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Kode galat yang stabil dari server (mis. EMAIL_NOT_REGISTERED); jangan mengandalkan teks pesan. */
    public code?: string,
  ) {
    super(message);
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const requestPath =
    BASE_URL.endsWith(DEFAULT_API_PREFIX) &&
    (normalizedPath === DEFAULT_API_PREFIX ||
      normalizedPath.startsWith(`${DEFAULT_API_PREFIX}/`))
      ? normalizedPath.slice(DEFAULT_API_PREFIX.length) || ''
      : normalizedPath;
  const res = await fetch(`${BASE_URL}${requestPath}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const rawMsg = body?.message;
    const message = Array.isArray(rawMsg)
      ? rawMsg.join(', ')
      : typeof rawMsg === 'string' && rawMsg.trim()
        ? rawMsg
        : res.statusText || 'Request failed';

    if (res.status === 401 && token && !requestPath.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('cidash:unauthorized'));
    }

    throw new ApiError(res.status, message, typeof body?.code === 'string' ? body.code : undefined);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T>(path: string, body?: unknown) =>
  http<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const put = <T>(path: string, body?: unknown) =>
  http<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });

export const del = <T>(path: string) =>
  http<T>(path, { method: 'DELETE' });
