/**
 * In-memory LRU cache with TTL support.
 * Used to avoid repeated DB/API calls for identical queries.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class MemCache<T = unknown> {
  private map = new Map<string, CacheEntry<T>>();
  private readonly maxSize: number;
  private readonly defaultTTL: number; // ms
  private hits = 0;
  private misses = 0;

  constructor(opts?: { maxSize?: number; ttlMs?: number }) {
    this.maxSize = opts?.maxSize ?? 500;
    this.defaultTTL = opts?.ttlMs ?? 60_000;
  }

  get(key: string): T | undefined {
    const entry = this.map.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      this.misses++;
      return undefined;
    }
    this.hits++;
    // Move to end (LRU refresh)
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.map.size >= this.maxSize) {
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) this.map.delete(firstKey);
    }
    this.map.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTL),
    });
  }

  has(key: string): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.map.delete(key);
      return false;
    }
    return true;
  }

  delete(key: string): boolean {
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /** Purge all expired entries */
  prune(): number {
    const now = Date.now();
    let pruned = 0;
    for (const [key, entry] of this.map) {
      if (now > entry.expiresAt) {
        this.map.delete(key);
        pruned++;
      }
    }
    return pruned;
  }

  get size(): number {
    return this.map.size;
  }

  get stats() {
    return {
      size: this.map.size,
      maxSize: this.maxSize,
      hits: this.hits,
      misses: this.misses,
      hitRate: this.hits + this.misses > 0
        ? Math.round((this.hits / (this.hits + this.misses)) * 100)
        : 0,
    };
  }
}

// ── Pre-built cache instances ──

/** Cache for search results (60s TTL) */
export const searchCache = new MemCache<unknown>({ maxSize: 300, ttlMs: 60_000 });

/** Cache for KB lookups (5 min TTL — KB changes rarely) */
export const kbCache = new MemCache<unknown>({ maxSize: 200, ttlMs: 300_000 });

/** Cache for user profile lookups (30s TTL) */
export const userCache = new MemCache<unknown>({ maxSize: 100, ttlMs: 30_000 });

/** Build a cache key from request params */
export function cacheKey(prefix: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${String(params[k] ?? "")}`)
    .join("&");
  return `${prefix}:${sorted}`;
}
