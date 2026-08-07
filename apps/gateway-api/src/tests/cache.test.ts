import { describe, it, expect } from "vitest";
import { MemCache, cacheKey } from "../lib/cache";

describe("MemCache", () => {
  it("stores and retrieves values", () => {
    const cache = new MemCache<string>({ maxSize: 5, ttlMs: 10_000 });
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");
    expect(cache.size).toBe(1);
  });

  it("returns undefined for missing keys", () => {
    const cache = new MemCache<string>();
    expect(cache.get("nope")).toBeUndefined();
  });

  it("expires entries after TTL", async () => {
    const cache = new MemCache<string>({ maxSize: 5, ttlMs: 50 });
    cache.set("key1", "value1");
    expect(cache.get("key1")).toBe("value1");

    // Wait for TTL
    await new Promise((r) => setTimeout(r, 100));
    expect(cache.get("key1")).toBeUndefined();
  });

  it("evicts oldest entry when maxSize reached", () => {
    const cache = new MemCache<string>({ maxSize: 3, ttlMs: 60_000 });
    cache.set("a", "1");
    cache.set("b", "2");
    cache.set("c", "3");
    cache.set("d", "4"); // should evict "a"
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("d")).toBe("4");
    expect(cache.size).toBe(3);
  });

  it("tracks hit/miss stats", () => {
    const cache = new MemCache<string>({ maxSize: 10 });
    cache.set("x", "y");
    cache.get("x"); // hit
    cache.get("missing"); // miss
    expect(cache.stats.hits).toBe(1);
    expect(cache.stats.misses).toBe(1);
    expect(cache.stats.hitRate).toBe(50);
  });

  it("prunes expired entries", async () => {
    const cache = new MemCache<string>({ maxSize: 10, ttlMs: 50 });
    cache.set("a", "1");
    cache.set("b", "2");
    await new Promise((r) => setTimeout(r, 100));
    const pruned = cache.prune();
    expect(pruned).toBe(2);
    expect(cache.size).toBe(0);
  });

  it("deletes entries", () => {
    const cache = new MemCache<string>();
    cache.set("k", "v");
    expect(cache.delete("k")).toBe(true);
    expect(cache.get("k")).toBeUndefined();
  });

  it("clears all entries and resets stats", () => {
    const cache = new MemCache<string>();
    cache.set("a", "1");
    cache.set("b", "2");
    cache.get("a");
    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.stats.hits).toBe(0);
  });
});

describe("cacheKey", () => {
  it("builds deterministic keys from params", () => {
    const k1 = cacheKey("prefix", { b: 2, a: 1 });
    const k2 = cacheKey("prefix", { a: 1, b: 2 });
    expect(k1).toBe(k2); // sorted
    expect(k1).toContain("prefix:");
  });

  it("handles empty params", () => {
    expect(cacheKey("test", {})).toBe("test:");
  });
});
