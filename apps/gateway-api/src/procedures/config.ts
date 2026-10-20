import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export type ProcedureRuntimeInfo = {
  kbRoot: string;
  dataDir: string;
  source: "proc-env" | "payload_sync" | "kb_vnext" | "legacy-env" | "kb_studio_export" | "unresolved";
};

function hasProcedureDataset(candidate: string): boolean {
  const dataDir = fs.existsSync(path.join(candidate, "data"))
    ? path.join(candidate, "data")
    : candidate;

  return ["procedures.jsonl", "documents.jsonl", "procedure_to_docs.jsonl"].every((fileName) =>
    fs.existsSync(path.join(dataDir, fileName)),
  );
}

function firstExistingPath(candidates: Array<string | undefined>): string {
  const resolved = candidates.filter((candidate): candidate is string => Boolean(candidate));
  for (const candidate of resolved) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return resolved[0] || "";
}

function getResolvedDataDir(root: string): string {
  const nestedDataDir = path.join(root, "data");
  return fs.existsSync(nestedDataDir) ? nestedDataDir : root;
}

export type ProcedureRuntimeReadiness = {
  ready: boolean;
  source: ProcedureRuntimeInfo["source"];
  dataDir: string;
  procedureRows: number;
  malformedRows: number;
  missingFiles: string[];
  reason: "READY" | "UNRESOLVED_SOURCE" | "MISSING_REQUIRED_FILES" | "EMPTY_PROCEDURES" | "MALFORMED_REQUIRED_JSONL";
};

const REQUIRED_PROCEDURE_DATASET_FILES = ["procedures.jsonl", "documents.jsonl", "procedure_to_docs.jsonl"] as const;

function inspectJsonlFile(filePath: string): { validRows: number; malformedRows: number; missing: boolean } {
  if (!fs.existsSync(filePath)) return { validRows: 0, malformedRows: 0, missing: true };
  let validRows = 0;
  let malformedRows = 0;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try { JSON.parse(trimmed); validRows += 1; } catch { malformedRows += 1; }
  }
  return { validRows, malformedRows, missing: false };
}

export function getPayloadSyncRuntimeRoot(): string {
  const configuredRoot = process.env.PAYLOAD_SYNC_RUNTIME_ROOT;
  if (configuredRoot) {
    return path.isAbsolute(configuredRoot)
      ? configuredRoot
      : path.resolve(path.resolve(__dirname, "..", "..", "..", ".."), configuredRoot);
  }
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  return path.resolve(repoRoot, "apps", "gateway-api", "runtime", "payload-sync");
}

function getPayloadSyncActiveDataDir(root: string): string | null {
  const pointerPath = path.join(root, "active.json");
  if (!fs.existsSync(pointerPath)) return null;

  try {
    const pointer = JSON.parse(fs.readFileSync(pointerPath, "utf8")) as { activeDirectory?: unknown };
    const activeDirectory = typeof pointer.activeDirectory === "string" ? pointer.activeDirectory.trim() : "";
    if (!activeDirectory) return null;

    const resolvedRoot = path.resolve(root);
    const resolvedDirectory = path.resolve(root, activeDirectory);
    const relativeDirectory = path.relative(resolvedRoot, resolvedDirectory);
    if (relativeDirectory.startsWith("..") || path.isAbsolute(relativeDirectory)) return null;
    return hasProcedureDataset(resolvedDirectory) ? resolvedDirectory : null;
  } catch {
    return null;
  }
}

function getProcedureRuntimeInfoInternal(): ProcedureRuntimeInfo {
  const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
  const projectxRoot = path.resolve(repoRoot, "..");
  const kbVNextRoot = path.resolve(repoRoot, "kb_vnext");

  const explicitProcedureRoot = process.env.WATANY_PROC_KB_ROOT;
  if (explicitProcedureRoot && hasProcedureDataset(explicitProcedureRoot)) {
    return {
      kbRoot: explicitProcedureRoot,
      dataDir: getResolvedDataDir(explicitProcedureRoot),
      source: "proc-env",
    };
  }

  const payloadSyncRoot = getPayloadSyncRuntimeRoot();
  const payloadSyncDataDir = getPayloadSyncActiveDataDir(payloadSyncRoot);
  if (payloadSyncDataDir) {
    return {
      kbRoot: payloadSyncDataDir,
      dataDir: payloadSyncDataDir,
      source: "payload_sync",
    };
  }

  if (hasProcedureDataset(kbVNextRoot)) {
    return {
      kbRoot: kbVNextRoot,
      dataDir: getResolvedDataDir(kbVNextRoot),
      source: "kb_vnext",
    };
  }

  const legacyKbRoot = process.env.WATANY_KB_ROOT;
  if (legacyKbRoot && hasProcedureDataset(legacyKbRoot)) {
    return {
      kbRoot: legacyKbRoot,
      dataDir: getResolvedDataDir(legacyKbRoot),
      source: "legacy-env",
    };
  }

  const exportCandidates = [
    process.env.KB_STUDIO_EXPORT_ROOT,
    path.resolve(projectxRoot, "kb-studio", "watany", "runtime", "exports", "watanybot"),
    path.resolve(projectxRoot, "kb-studio", "runtime", "exports", "watanybot"),
    path.resolve(repoRoot, "kb_studio", "runtime", "exports", "watanybot"),
  ];

  const preferredExportRoot = exportCandidates.find((candidate): candidate is string => Boolean(candidate && hasProcedureDataset(candidate)));
  if (preferredExportRoot) {
    return {
      kbRoot: preferredExportRoot,
      dataDir: getResolvedDataDir(preferredExportRoot),
      source: "kb_studio_export",
    };
  }

  const unresolvedRoot = firstExistingPath([
    explicitProcedureRoot,
    kbVNextRoot,
    legacyKbRoot,
    ...exportCandidates,
  ]);

  return {
    kbRoot: unresolvedRoot,
    dataDir: getResolvedDataDir(unresolvedRoot),
    source: "unresolved",
  };
}

export function evaluateProcedureRuntimeReadiness(runtime: ProcedureRuntimeInfo): ProcedureRuntimeReadiness {
  const inspections = REQUIRED_PROCEDURE_DATASET_FILES.map((fileName) => ({ fileName, ...inspectJsonlFile(path.join(runtime.dataDir, fileName)) }));
  const missingFiles = inspections.filter((item) => item.missing).map((item) => item.fileName);
  const malformedRows = inspections.reduce((sum, item) => sum + item.malformedRows, 0);
  const procedureRows = inspections.find((item) => item.fileName === "procedures.jsonl")?.validRows || 0;
  let reason: ProcedureRuntimeReadiness["reason"] = "READY";
  if (runtime.source === "unresolved") reason = "UNRESOLVED_SOURCE";
  else if (missingFiles.length > 0) reason = "MISSING_REQUIRED_FILES";
  else if (malformedRows > 0) reason = "MALFORMED_REQUIRED_JSONL";
  else if (procedureRows < 1) reason = "EMPTY_PROCEDURES";
  return { ready: reason === "READY", source: runtime.source, dataDir: runtime.dataDir, procedureRows, malformedRows, missingFiles, reason };
}

export function getProcedureRuntimeReadiness(): ProcedureRuntimeReadiness {
  return evaluateProcedureRuntimeReadiness(getProcedureRuntimeInfoInternal());
}

export function getProcedureRuntimeInfo(): ProcedureRuntimeInfo {
  return getProcedureRuntimeInfoInternal();
}

export function getKbRoot(): string {
  return getProcedureRuntimeInfoInternal().kbRoot;
}

export function getDataDir(): string {
  return getProcedureRuntimeInfoInternal().dataDir;
}

export function getFlowsDir(): string {
  const root = getKbRoot();
  const nestedFlowsDir = path.join(root, "data", "flows");
  const flatFlowsDir = path.join(root, "flows");
  return fs.existsSync(nestedFlowsDir) ? nestedFlowsDir : flatFlowsDir;
}

export function getDocsDir(): string {
  return path.join(getKbRoot(), "docs");
}

export function cacheTtlMs(): number {
  const v = process.env.WATANY_PROC_CACHE_TTL_MS;
  const n = v ? Number(v) : 15_000;
  return Number.isFinite(n) ? n : 15_000;
}
