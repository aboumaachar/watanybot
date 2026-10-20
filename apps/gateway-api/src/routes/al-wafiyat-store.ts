import fs from "node:fs";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";

/**
 * Synchronous, single-file mutation boundary. Never silently fall back to an
 * alternative data root. Lock files left by a crash require operator review.
 * Existing source records are NOT migrated by this module.
 */
export class DeathNoticeStoreError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = "DeathNoticeStoreError";
  }
}

export type DeathNoticeRow = Record<string, unknown>;
export type DeathNoticeMutation<T> = {
  changed: boolean;
  result: T;
};
export type DeathNoticeWriteEvidence = {
  changed: boolean;
  preimageSha256: string | null;
  postimageSha256: string | null;
  backupPath: string | null;
};
const sha = (bytes: Buffer): string => createHash("sha256").update(bytes).digest("hex");

function safeFsync(fd: number, context: "lock" | "backup" | "data"): void {
  try {
    fs.fsyncSync(fd);
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "EPERM" && process.platform === "win32") {
      if (context === "data") {
        // The data path demands durability. NTFS journal protects rename atomicity,
        // but file contents may reside only in OS write-back cache. Power loss between
        // close and cache flush can leave a zero-length or partial replacement.
        // Post-rename byte verification catches silent corruption *within this process*
        // but cannot guard against power loss before the OS flushes.
        throw new DeathNoticeStoreError(
          "FSYNC_DURABILITY_UNAVAILABLE",
          "fsync rejected (EPERM) on the data write path; refusing commit without durability proof",
        );
      }
      // Lock and backup fsync: coordination-only — the original data file is still intact.
      return;
    }
    throw error;
  }
}

export function readDeathNoticeRowsStrict(file: string): DeathNoticeRow[] {
  if (!fs.existsSync(file)) throw new DeathNoticeStoreError("DATA_FILE_MISSING", "Death notices file is not present");
  const original = fs.readFileSync(file, "utf8");
  const ids = new Set<string>();
  const records: DeathNoticeRow[] = [];
  for (const [index, line] of original.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    let row: unknown;
    try {
      row = JSON.parse(line);
    } catch {
      throw new DeathNoticeStoreError("CORRUPT_JSONL", `Invalid JSONL record at line ${index + 1}`);
    }
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new DeathNoticeStoreError("INVALID_ROW", `Invalid object at line ${index + 1}`);
    }
    const record = row as DeathNoticeRow;
    if (typeof record.id !== "string" || !record.id.trim()) {
      throw new DeathNoticeStoreError("INVALID_ROW_ID", `Missing ID at line ${index + 1}`);
    }
    if (ids.has(record.id)) {
      throw new DeathNoticeStoreError("DUPLICATE_ROW_ID", `Repeated ID at line ${index + 1}`);
    }
    ids.add(record.id);
    records.push(record);
  }
  return records;
}

function serializeRows(rows: DeathNoticeRow[]): Buffer {
  const ids = new Set<string>();
  for (const record of rows) {
    if (!record || typeof record !== "object" || Array.isArray(record)
      || typeof record.id !== "string" || !record.id.trim()
      || ids.has(record.id)) {
      throw new DeathNoticeStoreError("INVALID_MUTATION", "Mutation returned invalid or duplicate row ID");
    }
    ids.add(record.id);
  }
  return Buffer.from(rows.map((row) => JSON.stringify(row)).join("\n") + (rows.length ? "\n" : ""), "utf8");
}

function syncedFileWrite(file: string, bytes: Buffer, exclusive: boolean): void {
  const fd = fs.openSync(file, exclusive ? "wx" : "w", 0o600);
  try {
    let offset = 0;
    while (offset < bytes.length) {
      const n = fs.writeSync(fd, bytes, offset, bytes.length - offset, offset);
      if (n <= 0) throw new DeathNoticeStoreError("WRITE_INCOMPLETE", "No write progress");
      offset += n;
    }
    safeFsync(fd, "data");
  } finally {
    fs.closeSync(fd);
  }
}

export function mutateDeathNoticeRows<T>(
  file: string,
  update: (rows: DeathNoticeRow[]) => DeathNoticeMutation<T>,
): { result: T; evidence: DeathNoticeWriteEvidence } {
  const dir = path.dirname(file);
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    throw new DeathNoticeStoreError("DATA_DIRECTORY_MISSING", "Approved data directory missing");
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    throw new DeathNoticeStoreError("DATA_FILE_MISSING", "Approved data file missing");
  }
  const lockPath = file + ".write.lock";
  const owner = `${process.pid}:${randomUUID()}`;
  let lockFd: number;
  try {
    lockFd = fs.openSync(lockPath, "wx", 0o600);
  } catch (error) {
    throw new DeathNoticeStoreError("WRITE_LOCK_UNAVAILABLE", `Write lock not acquired: ${String(error)}`);
  }
  let tempPath: string | null = null;
  try {
    fs.writeSync(lockFd, owner);
    safeFsync(lockFd, "lock");
    // Read and modify while holding the same exclusive lock.
    const preimage = fs.readFileSync(file);
    const rows = readDeathNoticeRowsStrict(file);
    const mutation = update(rows);
    if (!mutation || typeof mutation.changed !== "boolean") {
      throw new DeathNoticeStoreError("INVALID_MUTATION", "Updater did not return a change decision");
    }
    if (!mutation.changed) return {
      result: mutation.result,
      evidence: { changed: false, preimageSha256: sha(preimage), postimageSha256: sha(preimage), backupPath: null },
    };
    const after = serializeRows(rows);
    // Backup retained, rather than deleting the only rollback owner.
    const nonce = randomUUID();
    const backup = `${file}.preimage.${nonce}.bak`;
    fs.copyFileSync(file, backup, fs.constants.COPYFILE_EXCL);
    const backupBytes = fs.readFileSync(backup);
    if (!backupBytes.equals(preimage)) {
      throw new DeathNoticeStoreError("PREIMAGE_CHANGED", "Backup and locked preimage differ");
    }
    const backupFd = fs.openSync(backup, "r");
    try { safeFsync(backupFd, "backup"); } finally { fs.closeSync(backupFd); }
    tempPath = path.join(dir, `.${path.basename(file)}.${nonce}.tmp`);
    syncedFileWrite(tempPath, after, true);
    if (!fs.readFileSync(tempPath).equals(after)) {
      throw new DeathNoticeStoreError("TEMP_VERIFY_FAILED", "Temporary file differs from expected bytes");
    }
    // Refuse replacement when a non-cooperating legacy writer changed the
    // source after our locked snapshot. This check alone is NOT cross-process
    // atomicity proof for writers that ignore the lock.
    if (!fs.readFileSync(file).equals(preimage)) {
      throw new DeathNoticeStoreError("UNCOOPERATIVE_WRITER_DETECTED", "Source changed before replacement");
    }
    // Original remains intact until the final replace. A preserved backup
    // permits operator-controlled rollback after failures or power loss.
    fs.renameSync(tempPath, file);
    tempPath = null;
    if (!fs.readFileSync(file).equals(after)) {
      throw new DeathNoticeStoreError("POSTIMAGE_VERIFY_FAILED", "Committed bytes differ from expected bytes");
    }
    return {
      result: mutation.result,
      evidence: { changed: true, preimageSha256: sha(preimage), postimageSha256: sha(after), backupPath: backup },
    };
  } finally {
    if (tempPath) {
      try { fs.unlinkSync(tempPath); } catch { /* preserve primary failure */ }
    }
    fs.closeSync(lockFd);
    // Never remove a lock replaced by another owner.
    try {
      if (fs.readFileSync(lockPath, "utf8") === owner) fs.unlinkSync(lockPath);
    } catch { /* fail closed for next writer: a residual lock blocks mutation */ }
  }
}
