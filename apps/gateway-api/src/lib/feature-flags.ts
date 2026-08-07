import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const FLAGS_FILE = join(process.cwd(), "data", "feature_flags.json");
const DEFAULT_BACKEND_FEATURE_FLAGS: Record<string, boolean> = {
  "community.enabled": true,
  "community.entry.enabled": true,
  "community.threads.enabled": true,
  "community.writes.enabled": true,
  "community.attachments.enabled": true,
  "community.announcements.enabled": true,
  "community.realtime.enabled": true,
  "community.realtime.polling_fallback.enabled": true,
};

function normalizeFeatureFlags(input: unknown): Record<string, boolean> {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => typeof value === "boolean"),
  );
}

function withBackendDefaults(flags: Record<string, boolean>): Record<string, boolean> {
  return {
    ...DEFAULT_BACKEND_FEATURE_FLAGS,
    ...flags,
  };
}

export type FeatureFlagsPayload = {
  flags: Record<string, boolean>;
  lastUpdatedAt: string | null;
};

export async function loadFeatureFlags(): Promise<Record<string, boolean>> {
  try {
    const raw = await readFile(FLAGS_FILE, "utf-8");
    return withBackendDefaults(normalizeFeatureFlags(JSON.parse(raw)));
  } catch {
    return { ...DEFAULT_BACKEND_FEATURE_FLAGS };
  }
}

export async function persistFeatureFlags(flags: Record<string, boolean>): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(FLAGS_FILE, JSON.stringify(flags, null, 2), "utf-8");
}

export async function getFeatureFlagsPayload(): Promise<FeatureFlagsPayload> {
  const flags = await loadFeatureFlags();

  try {
    const fileStats = await stat(FLAGS_FILE);
    return {
      flags,
      lastUpdatedAt: fileStats.mtime.toISOString(),
    };
  } catch {
    return {
      flags,
      lastUpdatedAt: null,
    };
  }
}

export async function isFeatureFlagEnabled(flagId: string, fallback = true): Promise<boolean> {
  const flags = await loadFeatureFlags();
  return typeof flags[flagId] === "boolean" ? flags[flagId] : fallback;
}