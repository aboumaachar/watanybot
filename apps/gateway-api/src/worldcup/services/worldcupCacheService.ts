/** In-memory TTL cache for WorldCup provider results. */
export type WorldCupCacheService = {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  invalidate(key: string): void;
};

type CacheEntry = { value: unknown; expiresAt: number };

export function createWorldCupCacheService(): WorldCupCacheService {
  const store = new Map<string, CacheEntry>();

  return {
    async get<T>(key: string): Promise<T | null> {
      const entry = store.get(key);
      if (!entry) return null;
      if (Date.now() > entry.expiresAt) {
        store.delete(key);
        return null;
      }
      return entry.value as T;
    },

    async set<T>(key: string, value: T, ttlSeconds = 60): Promise<void> {
      store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },

    invalidate(key: string): void {
      store.delete(key);
    },
  };
}
