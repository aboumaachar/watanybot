import { afterEach, describe, expect, it } from "vitest";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadIndex, reloadIndex } from "../procedures/indexer.js";

const savedEnv = {
  PAYLOAD_SYNC_RUNTIME_ROOT: process.env.PAYLOAD_SYNC_RUNTIME_ROOT,
  KB_STUDIO_EXPORT_ROOT: process.env.KB_STUDIO_EXPORT_ROOT,
  WATANY_PROC_KB_ROOT: process.env.WATANY_PROC_KB_ROOT,
};

async function restoreEnv(): Promise<void> {
  for (const [key, value] of Object.entries(savedEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  await reloadIndex();
}

afterEach(async () => restoreEnv());

describe("payload_sync official reference overlay", () => {
  it("preserves a missing LAF form reference without replacing Payload canonical documents", async () => {
    const temp = await mkdtemp(path.join(os.tmpdir(), "watany-payload-overlay-"));
    try {
      const payloadRoot = path.join(temp, "payload");
      const activeDir = path.join(payloadRoot, "run-1");
      const overlayRoot = path.join(temp, "overlay");
      await mkdir(activeDir, { recursive: true });
      await mkdir(path.join(overlayRoot, "docs", "sources"), { recursive: true });

      const sourceData = path.resolve(process.cwd(), "..", "..", "kb_vnext", "data");
      for (const name of ["procedures.jsonl", "documents.jsonl", "procedure_to_docs.jsonl"]) {
        await copyFile(path.join(sourceData, name), path.join(activeDir, name));
      }
      await writeFile(path.join(payloadRoot, "active.json"), JSON.stringify({ activeDirectory: "run-1" }));

      await writeFile(path.join(overlayRoot, "documents.jsonl"), JSON.stringify({
        id: "DOC-WATANY_LAF_HTML-TEST",
        title: "Synthetic LAF form reference",
        asset_type: "form",
        exported_file_path: "sources/laf.html",
        preview_enabled: true,
        download_enabled: true,
      }) + "\n");
      const bundledHtml = path.join(overlayRoot, "docs", "sources", "laf.html");
      await writeFile(bundledHtml, "<html><body id=\"transaction-test\">reference</body></html>");

      process.env.PAYLOAD_SYNC_RUNTIME_ROOT = payloadRoot;
      process.env.KB_STUDIO_EXPORT_ROOT = overlayRoot;
      delete process.env.WATANY_PROC_KB_ROOT;

      await reloadIndex();
      const state = await loadIndex(false);
      const reference = state.docs.find((doc) => doc.id === "DOC-WATANY_LAF_HTML-TEST");
      expect(reference).toMatchObject({ asset_type: "form", resolved_path: bundledHtml });
      expect(reference?.resolved_path).toBe(bundledHtml);
      expect(state.docs.filter((doc) => doc.id === "summary-proc-0001")).toHaveLength(1);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  });
});