/**
 * TTS Response Caching with LRU
 * 
 * Caches TTS audio responses to reduce redundant API calls for common phrases.
 * Uses LRU eviction policy to keep memory usage bounded.
 */

interface CacheEntry {
  audio: Buffer;
  timestamp: number;
  hits: number;
}

/**
 * Simple LRU Cache implementation for TTS responses
 * Uses timestamp-based ordering for age tracking
 */
export class TtsCache {
  private cache: Map<string, CacheEntry> = new Map();
  private maxEntries: number;
  private maxAgeMs: number;

  constructor(config: { maxEntries?: number; maxAgeMs?: number } = {}) {
    this.maxEntries = config.maxEntries || Number(process.env.TTS_CACHE_MAX_ENTRIES || "100");
    this.maxAgeMs = config.maxAgeMs || Number(process.env.TTS_CACHE_MAX_AGE_MS || "86400000"); // 24 hours default
  }

  /**
   * Generate cache key from text and language
   */
  private generateKey(text: string, lang: string = "ar"): string {
    // Normalize whitespace and create hash-like key
    const normalized = text.toLowerCase().trim().replace(/\s+/g, " ");
    return `${lang}:${normalized}`;
  }

  /**
   * Get audio from cache
   * Returns null if not found or expired
   */
  get(text: string, lang: string = "ar"): Buffer | null {
    const key = this.generateKey(text, lang);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    if (Date.now() - entry.timestamp > this.maxAgeMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count and move to end (MRU)
    entry.hits++;
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.audio;
  }

  /**
   * Store audio in cache
   */
  set(text: string, audio: Buffer, lang: string = "ar"): void {
    const key = this.generateKey(text, lang);

    // If at capacity, remove least recently used (first entry)
    if (this.cache.size >= this.maxEntries) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      audio,
      timestamp: Date.now(),
      hits: 1,
    });
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      totalHits,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
    };
  }

  /**
   * Preload common phrases into cache
   * Useful for warming cache with frequently-used responses
   */
  preload(entries: Array<{ text: string; audio: Buffer; lang?: string }>): number {
    let loaded = 0;
    for (const { text, audio, lang } of entries) {
      this.set(text, audio, lang);
      loaded++;
    }
    return loaded;
  }
}

/**
 * Global TTS cache instance
 */
export const ttsCache = new TtsCache();
