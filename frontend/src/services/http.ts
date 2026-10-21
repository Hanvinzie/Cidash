// ============================================================
// HTTP client untuk REST API NestJS (mendukung Ngrok & Proxy).
// ============================================================

function resolveBaseUrl(): string {
  const configured = (
    import.meta.env.VITE_API_URL ||
    import.meta.env.VITE_API_BASE_URL ||
    ''
  )
    .trim()
    .replace(/\/+$/, '');

  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    const isLocalBrowser = host === 'localhost' || host === '127.0.0.1';
    const pointsToLocal =
      !configured ||
      configured.includes('localhost') ||
      configured.includes('127.0.0.1');

    // Jika dibuka melalui tunnel (ngrok) atau IP jaringan di perangkat lain,
    // dan env masih mengarah ke localhost, gunakan relative URL ('') agar
    // otomatis diteruskan oleh Vite proxy (:5173 -> :3000).
    if (!isLocalBrowser && pointsToLocal) {
      return '';
    }
  }

  return configured || 'http://localhost:3000';
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
  ) {
    super(message);
  }
}

export async function http<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${BASE_URL}${path}`, {
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

    if (res.status === 401 && token && !path.startsWith('/auth/login')) {
      tokenStore.clear();
      window.dispatchEvent(new CustomEvent('cidash:unauthorized'));
    }

    throw new ApiError(res.status, message);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const post = <T>(path: string, body?: unknown) =>
  http<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined });

export const del = <T>(path: string) =>
  http<T>(path, { method: 'DELETE' });
