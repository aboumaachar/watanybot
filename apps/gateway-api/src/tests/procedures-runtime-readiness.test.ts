import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { evaluateProcedureRuntimeReadiness, type ProcedureRuntimeInfo } from "../procedures/config.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

async function runtime(): Promise<ProcedureRuntimeInfo> {
  const root = await mkdtemp(path.join(tmpdir(), "watany-procedures-ready-"));
  roots.push(root);
  const dataDir = path.join(root, "data");
  await mkdir(dataDir, { recursive: true });
  return { kbRoot: root, dataDir, source: "payload_sync" };
}

async function writeRequired(info: ProcedureRuntimeInfo, procedures: string, documents = "", mappings = "") {
  await writeFile(path.join(info.dataDir, "procedures.jsonl"), procedures, "utf8");
  await writeFile(path.join(info.dataDir, "documents.jsonl"), documents, "utf8");
  await writeFile(path.join(info.dataDir, "procedure_to_docs.jsonl"), mappings, "utf8");
}
describe("Procedures runtime readiness", () => {
  it("fails closed when required dataset files are missing", async () => {
    const info = await runtime();
    const status = evaluateProcedureRuntimeReadiness(info);
    expect(status.ready).toBe(false);
    expect(status.reason).toBe("MISSING_REQUIRED_FILES");
    expect(status.missingFiles).toContain("procedures.jsonl");
  });

  it("fails closed when the canonical Procedures file is empty", async () => {
    const info = await runtime();
    await writeRequired(info, "");
    expect(evaluateProcedureRuntimeReadiness(info)).toMatchObject({ ready: false, reason: "EMPTY_PROCEDURES", procedureRows: 0 });
  });

  it("fails closed when any required JSONL row is malformed", async () => {
    const info = await runtime();
    await writeRequired(info, '{"id":"proc-ok"}\n', '{broken-json}\n');
    expect(evaluateProcedureRuntimeReadiness(info)).toMatchObject({ ready: false, reason: "MALFORMED_REQUIRED_JSONL", malformedRows: 1 });
  });

  it("accepts a non-empty fully parseable required dataset", async () => {
    const info = await runtime();
    await writeRequired(info, '{"id":"proc-ok"}\n');
    expect(evaluateProcedureRuntimeReadiness(info)).toMatchObject({ ready: true, reason: "READY", procedureRows: 1, malformedRows: 0, missingFiles: [] });
  });
});
