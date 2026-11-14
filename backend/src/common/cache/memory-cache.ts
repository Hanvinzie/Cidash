interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Lightweight, bounded in-memory TTL cache untuk menurunkan beban roundtrip
 * query berulang ke Supabase PostgreSQL (seperti validasi JWT per-request &
 * polling leaderboard Circle secara bersamaan oleh hingga 25 anggota).
 *
 * Tetap stateless-safe untuk multi-instance karena memakai TTL sangat singkat
 * (5 - 15 detik) serta auto-invalidation pada setiap operasi mutasi (write).
 */
class MemoryTtlCache {
  private readonly store = new Map<string, CacheEntry<unknown>>();
  private readonly maxEntries = 2_000;

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.size >= this.maxEntries) {
      const now = Date.now();
      for (const [k, v] of this.store.entries()) {
        if (now >= v.expiresAt) {
          this.store.delete(k);
        }
      }
      if (this.store.size >= this.maxEntries) {
        const oldestKey = this.store.keys().next().value;
        if (oldestKey) this.store.delete(oldestKey);
      }
    }
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

   invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }
}

export const appMemoryCache = new MemoryTtlCache();

export const USER_AUTH_CACHE_TTL_MS = 15_000;
export const LEADERBOARD_CACHE_TTL_MS = 5_000;

export function invalidateUserCache(userId: string): void {
  appMemoryCache.invalidate(`user:${userId}`);
  // Invalidasi juga cache leaderboard karena poin/status anggota berubah
  appMemoryCache.invalidatePrefix('leaderboard:');
}

export function invalidateSquadCache(squadId?: string): void {
  if (squadId) {
    appMemoryCache.invalidate(`leaderboard:${squadId}`);
  } else {
    appMemoryCache.invalidatePrefix('leaderboard:');
  }
}
