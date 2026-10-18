import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { AdminPaymentsStore } from "./types.js";
import { adminPaymentsStoreSchema } from "./schemas.js";

const STORE_DIR = path.join(process.cwd(), "data");
const STORE_PATH = path.join(STORE_DIR, "admin-payments.json");

function createInitialStore(): AdminPaymentsStore {
  return { questions: [], answers: [], announcements: [] };
}

function ensureStoreDir(): void {
  fs.mkdirSync(STORE_DIR, { recursive: true });
}

function validateStore(input: unknown): AdminPaymentsStore {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("admin_payments_store_invalid_shape");
  }
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.questions) || !Array.isArray(value.answers) || !Array.isArray(value.announcements)) {
    throw new Error("admin_payments_store_invalid_collections");
  }
  // Never silently discard malformed records from an existing payment store.
  return adminPaymentsStoreSchema.parse(input);
}

function createStoreOnlyIfMissing(): AdminPaymentsStore {
  const initial = createInitialStore();
  fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2), { encoding: "utf8", flag: "wx" });
  return initial;
}

export function readStore(): AdminPaymentsStore {
  ensureStoreDir();
  let raw: string;
  try {
    raw = fs.readFileSync(STORE_PATH, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // Exclusive creation prevents a missing-file race from overwriting data.
      return createStoreOnlyIfMissing();
    }
    throw error;
  }
  // A corrupt, inaccessible or invalid existing store must never be reset.
  return validateStore(JSON.parse(raw));
}

export function writeStore(data: AdminPaymentsStore): void {
  const valid = validateStore(data);
  ensureStoreDir();
  // Direct writers must not silently overwrite an unreadable existing store.
  try {
    const current = fs.readFileSync(STORE_PATH, "utf8");
    validateStore(JSON.parse(current));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const tempPath = path.join(STORE_DIR, ".admin-payments-" + process.pid + "-" + randomUUID() + ".tmp");
  try {
    fs.writeFileSync(tempPath, JSON.stringify(valid, null, 2), { encoding: "utf8", flag: "wx" });
    fs.renameSync(tempPath, STORE_PATH);
  } catch (error) {
    // Clean up only the unique temporary file created by this invocation.
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw error;
  }
}

export { STORE_PATH };
