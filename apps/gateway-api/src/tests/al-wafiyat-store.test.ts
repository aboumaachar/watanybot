import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  DeathNoticeStoreError,
  mutateDeathNoticeRows,
  readDeathNoticeRowsStrict,
} from "../routes/al-wafiyat-store";

let root = "";
let file = "";
const baseline = '{"id":"qa-a","name":"عنصر تجريبي","status":"under_review"}\n';
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), "al-wafiyat-store-contract-"));
  file = path.join(root, "death-notices.jsonl");
  fs.writeFileSync(file, baseline, "utf8");
});
afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

describe("al-wafiyat guarded JSONL storage", () => {
  it("preserves a verified rollback preimage before a changed transaction", () => {
    const result = mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-b", status: "under_review" });
      return { changed: true, result: "added" };
    });
    expect(result.result).toBe("added");
    expect(result.evidence.changed).toBe(true);
    expect(result.evidence.preimageSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.evidence.postimageSha256).toMatch(/^[0-9a-f]{64}$/);
    expect(result.evidence.backupPath).toBeTruthy();
    expect(fs.readFileSync(result.evidence.backupPath!, "utf8")).toBe(baseline);
    expect(readDeathNoticeRowsStrict(file)).toHaveLength(2);
    expect(fs.existsSync(file + ".write.lock")).toBe(false);
    // Restoration is only synthetic-fixture evidence, never a Production rollback.
    fs.copyFileSync(result.evidence.backupPath!, file);
    expect(fs.readFileSync(file, "utf8")).toBe(baseline);
  });

  it("does not mutate or create backups for a no-op decision", () => {
    const result = mutateDeathNoticeRows(file, () => ({ changed: false, result: "noop" }));
    expect(result.evidence).toMatchObject({ changed: false, backupPath: null });
    expect(fs.readFileSync(file, "utf8")).toBe(baseline);
    expect(fs.readdirSync(root).filter((x) => x.includes(".preimage."))).toEqual([]);
  });

  it("rejects a competing writer, preserving both existing bytes and lock", () => {
    fs.writeFileSync(file + ".write.lock", "another-owner", { flag: "wx" });
    expect(() => mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-b" });
      return { changed: true, result: true };
    })).toThrowError(DeathNoticeStoreError);
    expect(fs.readFileSync(file, "utf8")).toBe(baseline);
    expect(fs.readFileSync(file + ".write.lock", "utf8")).toBe("another-owner");
  });

  it("fails closed on malformed JSONL rather than silently truncating rows", () => {
    const corrupt = baseline + '{"id":"incomplete"\n';
    fs.writeFileSync(file, corrupt);
    expect(() => mutateDeathNoticeRows(file, () => ({ changed: true, result: true }))).toThrowError(DeathNoticeStoreError);
    expect(fs.readFileSync(file, "utf8")).toBe(corrupt);
    expect(fs.existsSync(file + ".write.lock")).toBe(false);
  });

  it("preserves preimage on a throwing updater", () => {
    expect(() => mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-b" });
      throw new Error("synthetic failure before commit");
    })).toThrow("synthetic failure before commit");
    expect(fs.readFileSync(file, "utf8")).toBe(baseline);
    expect(fs.existsSync(file + ".write.lock")).toBe(false);
  });

  it("rejects duplicate IDs before backup or replacement", () => {
    expect(() => mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-a" });
      return { changed: true, result: true };
    })).toThrowError(DeathNoticeStoreError);
    expect(fs.readFileSync(file, "utf8")).toBe(baseline);
    expect(fs.readdirSync(root).filter((x) => x.includes(".preimage."))).toEqual([]);
  });

  it("preserves both sequential write results without reverting a later entry", () => {
    mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-b" });
      return { changed: true, result: true };
    });
    mutateDeathNoticeRows(file, (rows) => {
      rows.push({ id: "qa-c" });
      return { changed: true, result: true };
    });
    expect(readDeathNoticeRowsStrict(file).map((row) => row.id)).toEqual(["qa-a", "qa-b", "qa-c"]);
  });
});
