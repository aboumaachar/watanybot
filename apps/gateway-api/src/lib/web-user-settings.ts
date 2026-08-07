import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  defaultPublishedWebUserSettings,
  sanitizePublishedWebUserSettings,
  type PublishedWebUserSettings,
  type PublishedWebUserSettingsPayload,
} from "@watany/shared/web-user-settings";

const SETTINGS_FILE = join(process.cwd(), "data", "web_user_settings.json");

export async function loadPublishedWebUserSettings(): Promise<PublishedWebUserSettings> {
  try {
    const raw = await readFile(SETTINGS_FILE, "utf-8");
    return sanitizePublishedWebUserSettings(JSON.parse(raw));
  } catch {
    return defaultPublishedWebUserSettings();
  }
}

export async function persistPublishedWebUserSettings(settings: PublishedWebUserSettings): Promise<void> {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(SETTINGS_FILE, JSON.stringify(sanitizePublishedWebUserSettings(settings), null, 2), "utf-8");
}

export async function getPublishedWebUserSettingsPayload(): Promise<PublishedWebUserSettingsPayload> {
  const settings = await loadPublishedWebUserSettings();

  try {
    const fileStats = await stat(SETTINGS_FILE);
    return {
      settings,
      lastUpdatedAt: fileStats.mtime.toISOString(),
    };
  } catch {
    return {
      settings,
      lastUpdatedAt: null,
    };
  }
}