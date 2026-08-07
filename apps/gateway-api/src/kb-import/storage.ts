import { mkdir } from "node:fs/promises";
import path from "node:path";

export function getKbImportDataRoot(): string {
  return process.env.KB_IMPORT_DATA_DIR || path.join(process.cwd(), "data", "kb-import");
}

export function getKbImportPaths() {
  const root = getKbImportDataRoot();
  return {
    root,
    jobsPath: path.join(root, "jobs.json"),
    quarantineDir: path.join(root, "quarantine"),
    acceptedDir: path.join(root, "accepted"),
    publishedJsonl: path.join(root, "published-kb.jsonl"),
    auditJsonl: path.join(root, "audit.jsonl"),
  };
}

export async function ensureKbImportStorage(): Promise<ReturnType<typeof getKbImportPaths>> {
  const paths = getKbImportPaths();
  await mkdir(paths.root, { recursive: true });
  await mkdir(paths.quarantineDir, { recursive: true });
  await mkdir(paths.acceptedDir, { recursive: true });
  return paths;
}