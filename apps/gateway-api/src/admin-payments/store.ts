import fs from "node:fs";
import path from "node:path";
import type { AdminPaymentsStore } from "./types.js";
import {
  adminPaymentsStoreSchema,
  announcementSchema,
  paymentAnswerSchema,
  paymentQuestionSchema,
} from "./schemas.js";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "admin-payments.json");

function createInitialStore(): AdminPaymentsStore {
  return {
    questions: [],
    answers: [],
    announcements: [],
  };
}

function ensureStoreDir(): void {
  if (!fs.existsSync(STORE_DIR)) {
    fs.mkdirSync(STORE_DIR, { recursive: true });
  }
}

function normalizeCollection<T>(items: unknown, normalizeItem: (value: unknown) => T | null): T[] {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .map((item) => normalizeItem(item))
    .filter((item): item is T => item !== null);
}

function normalizeStore(input: unknown): AdminPaymentsStore {
  const source = input && typeof input === "object" ? input as Record<string, unknown> : {};

  return adminPaymentsStoreSchema.parse({
    questions: normalizeCollection(source.questions, (value) => {
      const result = paymentQuestionSchema.safeParse(value);
      return result.success ? result.data : null;
    }),
    answers: normalizeCollection(source.answers, (value) => {
      const result = paymentAnswerSchema.safeParse(value);
      return result.success ? result.data : null;
    }),
    announcements: normalizeCollection(source.announcements, (value) => {
      const result = announcementSchema.safeParse(value);
      return result.success ? result.data : null;
    }),
  });
}

function resetStoreFile(): AdminPaymentsStore {
  const initial = createInitialStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), "utf-8");
  return initial;
}

function ensureStore(): AdminPaymentsStore {
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

export function readStore(): AdminPaymentsStore {
  return ensureStore();
}

export function writeStore(data: AdminPaymentsStore): void {
  ensureStoreDir();
  fs.writeFileSync(STORE_PATH, JSON.stringify(normalizeStore(data), null, 2), "utf-8");
}

export { STORE_PATH };