import type { PluginDb } from "../types/domain.js";

export const DEFAULT_TICKER_CYCLE_MS = 240_000;
export const MIN_TICKER_CYCLE_MS = 60_000;
export const MAX_TICKER_CYCLE_MS = 300_000;

export type TickerSettings = {
  cycleMs: number;
};

export function normalizeTickerCycleMs(value: unknown, fallback = DEFAULT_TICKER_CYCLE_MS): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  const rounded = Math.round(numeric);
  if (rounded < MIN_TICKER_CYCLE_MS || rounded > MAX_TICKER_CYCLE_MS) return fallback;
  return rounded;
}

export function readTickerSettings(pluginDb: PluginDb): TickerSettings {
  try {
    const row = pluginDb.prepare("SELECT cycle_ms FROM ticker_settings WHERE id = ?").get("global") as { cycle_ms?: unknown } | undefined;
    return { cycleMs: normalizeTickerCycleMs(row?.cycle_ms) };
  } catch {
    return { cycleMs: DEFAULT_TICKER_CYCLE_MS };
  }
}

export function writeTickerSettings(pluginDb: PluginDb, cycleMs: unknown, updatedBy?: string | null): TickerSettings {
  const normalized = normalizeTickerCycleMs(cycleMs, Number.NaN);
  if (!Number.isFinite(normalized)) {
    throw new RangeError("TICKER_CYCLE_MS_OUT_OF_RANGE");
  }

  const now = Date.now();
  const existing = pluginDb.prepare("SELECT id FROM ticker_settings WHERE id = ?").get("global") as { id?: string } | undefined;
  if (existing?.id) {
    pluginDb.prepare("UPDATE ticker_settings SET cycle_ms = ?, updated_at = ?, updated_by = ? WHERE id = ?")
      .run(normalized, now, updatedBy || null, "global");
  } else {
    pluginDb.prepare("INSERT INTO ticker_settings (id, cycle_ms, updated_at, updated_by) VALUES (?, ?, ?, ?)")
      .run("global", normalized, now, updatedBy || null);
  }

  return { cycleMs: normalized };
}
