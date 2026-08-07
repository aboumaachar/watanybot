import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ProcedureRuntimeInfo = {
  kbRoot: string;
  dataDir: string;
  source: "proc-env" | "kb_vnext" | "legacy-env" | "kb_studio_export" | "unresolved";
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
