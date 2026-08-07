import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const originalRagPath = process.env.AI_RAG_CHUNKS_PATH;

afterEach(() => {
  if (typeof originalRagPath === "string") {
    process.env.AI_RAG_CHUNKS_PATH = originalRagPath;
  } else {
    delete process.env.AI_RAG_CHUNKS_PATH;
  }
  vi.resetModules();
});

describe("resolveRagPath", () => {
  it("defaults to the repo-root runtime chunks file", async () => {
    delete process.env.AI_RAG_CHUNKS_PATH;
    vi.resetModules();

    const { resolveRagPath, repoRoot } = await import("../lib/config");
    const resolved = resolveRagPath();
    const expected = path.resolve(repoRoot, "watany_kb_tables_v4/watany_rag_chunks_v4.jsonl");

    expect(resolved).toBe(expected);
    expect(fs.existsSync(resolved)).toBe(true);
  });
});
