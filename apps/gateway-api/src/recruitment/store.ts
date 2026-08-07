import fs from "node:fs";
import path from "node:path";
import type { RecruitmentStore } from "./types.js";
import { recruitmentAnnouncementSchema, recruitmentStoreSchema } from "./schemas.js";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "recruitment-announcements.json");

function createInitialStore(): RecruitmentStore {
  return { announcements: [] };
}

function ensureStoreDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function normalizeStore(input: unknown): RecruitmentStore {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};
  const announcements = Array.isArray(source.announcements)
    ? source.announcements
      .map((item) => recruitmentAnnouncementSchema.safeParse(item))
      .filter((result) => result.success)
      .map((result) => result.data)
    : [];

  return recruitmentStoreSchema.parse({ announcements });
}

function resetStoreFile(): RecruitmentStore {
  const initial = createInitialStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
  return initial;
}

function ensureStore(): RecruitmentStore {
  ensureStoreDir();

  if (!fs.existsSync(STORE_PATH)) {
    return resetStoreFile();
  }

  try {
    const raw = fs.readFileSync(STORE_PATH, "utf-8");
    return normalizeStore(JSON.parse(raw));
  } catch {
    return resetStoreFile();
  }
}

export function readStore(): RecruitmentStore {
  return ensureStore();
}

export function writeStore(data: RecruitmentStore): void {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(normalizeStore(data), null, 2), "utf-8");
}

export { STORE_PATH };