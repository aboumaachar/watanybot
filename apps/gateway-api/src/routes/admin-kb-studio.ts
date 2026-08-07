import fs from "node:fs";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { FastifyPluginAsync } from "fastify";
import { requireRole } from "../auth/rbac.js";

const execAsync = promisify(exec);

function quoteShellArg(value: string): string {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function resolvePythonExecutable(repoRootPath: string): string {
  const candidates = [
    process.env.PYTHON_EXECUTABLE,
    path.join(repoRootPath, ".venv", "Scripts", "python.exe"),
    path.join(repoRootPath, ".venv", "bin", "python"),
    "python",
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (!candidate.includes(path.sep) || fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return "python";
}

export interface AdminKbStudioRoutesOptions {
  kbStudioMetaRoot: string;
  kbStudioWorkspaceRoot: string;
  kbStudioExportRoot: string;
  kbStudioImportRoot: string;
  repoRootPath: string;
}

const EXPORTED_ARTIFACTS = [
  "directory_entries.jsonl",
  "documents.jsonl",
  "faq_seeds.jsonl",
  "flow_definitions.jsonl",
  "kb_nodes.db",
  "manifest.json",
  "procedures.jsonl",
  "procedure_to_directories.jsonl",
  "procedure_to_docs.jsonl",
  "router_index.json",
  "tags_lexicon.json",
  "docs",
  "flows",
];

async function readKbStudioJson(filePath: string, log: { error: (payload: unknown, message: string) => void }) {
  try {
    const content = await fs.promises.readFile(filePath, "utf-8");
    return JSON.parse(content);
  } catch (err: any) {
    log.error({ filePath, err }, "Failed to read KB Studio file");
    return null;
  }
}

async function writeKbStudioJson(filePath: string, data: unknown) {
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
}

async function inspectGeneratedKb(exportRoot: string, log: { error: (payload: unknown, message: string) => void }) {
  const manifestPath = path.join(exportRoot, "manifest.json");
  const manifest = await readKbStudioJson(manifestPath, log);
  if (!manifest) {
    return null;
  }

  const manifestStats = await fs.promises.stat(manifestPath);
  const sqlitePath = path.join(exportRoot, "kb_nodes.db");
  const sqliteExists = fs.existsSync(sqlitePath);

  return {
    exportRoot,
    manifestPath,
    manifestMtime: manifestStats.mtime.toISOString(),
    sqlitePath,
    sqliteExists,
    counts: manifest.counts || {},
    manifest,
  };
}

async function resolveAvailableKbRoot(
  preferredRoot: string,
  fallbackRoot: string,
  log: { error: (payload: unknown, message: string) => void },
) {
  const preferredInspection = await inspectGeneratedKb(preferredRoot, log);
  if (preferredInspection) {
    return preferredInspection;
  }

  if (fallbackRoot && fallbackRoot !== preferredRoot) {
    return inspectGeneratedKb(fallbackRoot, log);
  }

  return null;
}

async function syncKbStudioExport(sourceRoot: string, targetRoot: string) {
  if (path.resolve(sourceRoot) === path.resolve(targetRoot)) {
    return {
      sourceRoot,
      targetRoot,
      copied: [],
      skipped: true,
    };
  }

  await fs.promises.mkdir(targetRoot, { recursive: true });

  const copied: string[] = [];
  for (const artifact of EXPORTED_ARTIFACTS) {
    const sourcePath = path.join(sourceRoot, artifact);
    if (!fs.existsSync(sourcePath)) {
      continue;
    }

    const targetPath = path.join(targetRoot, artifact);
    const stats = await fs.promises.stat(sourcePath);

    if (stats.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true, force: true });
      await fs.promises.cp(sourcePath, targetPath, { recursive: true, force: true });
    } else {
      await fs.promises.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.promises.copyFile(sourcePath, targetPath);
    }

    copied.push(artifact);
  }

  return {
    sourceRoot,
    targetRoot,
    copied,
  };
}

async function runKbStudioCommand(
  command: string,
  timeout: number,
  successMessage: string,
  failureMessage: string,
  log: {
    info: (payload: unknown, message?: string) => void;
    error: (payload: unknown, message: string) => void;
  },
  workingDirectory: string,
) {
  try {
    log.info({ command, cwd: workingDirectory }, successMessage);
    const { stdout, stderr } = await execAsync(command, {
      cwd: workingDirectory,
      timeout,
    });
    log.info({ stdout, stderr }, `${successMessage} completed`);
    return { ok: true, message: `${successMessage} completed`, stdout, stderr };
  } catch (err: any) {
    log.error({ err }, failureMessage);
    return {
      ok: false,
      error: err.message,
      stdout: err.stdout,
      stderr: err.stderr,
    };
  }
}

async function rebuildBackendKbFromExport(
  options: AdminKbStudioRoutesOptions,
  exportRoot: string,
  log: {
    info: (payload: unknown, message?: string) => void;
    error: (payload: unknown, message: string) => void;
  },
) {
  const repoRoot = options.repoRootPath || process.cwd();
  const pythonExecutable = resolvePythonExecutable(repoRoot);
  const scriptPath = path.join(repoRoot, "apps", "api-backend", "scripts", "rebuild_from_kb_studio_export.py");
  const command = [
    quoteShellArg(pythonExecutable),
    quoteShellArg(scriptPath),
    "--export-root",
    quoteShellArg(exportRoot),
  ].join(" ");

  return runKbStudioCommand(
    command,
    900000,
    "Starting backend v4 rebuild from KB Studio export...",
    "Backend v4 rebuild from KB Studio export failed",
    log,
    repoRoot,
  );
}

export const adminKbStudioRoutes: FastifyPluginAsync<AdminKbStudioRoutesOptions> = async (app, options) => {
  const externalSourcesPath = path.join(options.kbStudioMetaRoot, "external_sources.json");
  const manifestPath = path.join(options.kbStudioExportRoot, "manifest.json");
  const reportsDir = path.join(options.kbStudioMetaRoot, "reports");

  // Guard every KB Studio route — admin role required
  app.addHook("preHandler", requireRole("admin"));

  app.get("/api/admin/kb-studio/sources", async (_req, reply) => {
    const sources = await readKbStudioJson(externalSourcesPath, app.log);
    if (!sources) {
      return reply.code(500).send({ ok: false, error: "Failed to read external_sources.json" });
    }
    return { ok: true, sources };
  });

  app.post("/api/admin/kb-studio/sources/folder", async (req: any, reply) => {
    const { folder } = req.body || {};
    if (!folder || typeof folder !== "string") {
      return reply.code(400).send({ ok: false, error: "Missing folder path" });
    }

    const sources = await readKbStudioJson(externalSourcesPath, app.log);
    if (!sources) {
      return reply.code(500).send({ ok: false, error: "Failed to read external_sources.json" });
    }

    if (!Array.isArray(sources.folders)) sources.folders = [];
    if (sources.folders.includes(folder)) {
      return { ok: true, message: "Folder already exists", sources };
    }

    sources.folders.push(folder);
    await writeKbStudioJson(externalSourcesPath, sources);
    app.log.info({ folder }, "Added folder to KB Studio sources");
    return { ok: true, sources };
  });

  app.delete("/api/admin/kb-studio/sources/folder", async (req: any, reply) => {
    const { folder } = req.body || {};
    if (!folder || typeof folder !== "string") {
      return reply.code(400).send({ ok: false, error: "Missing folder path" });
    }

    const sources = await readKbStudioJson(externalSourcesPath, app.log);
    if (!sources) {
      return reply.code(500).send({ ok: false, error: "Failed to read external_sources.json" });
    }

    if (!Array.isArray(sources.folders)) sources.folders = [];
    const index = sources.folders.indexOf(folder);
    if (index === -1) {
      return { ok: true, message: "Folder not found in sources", sources };
    }

    sources.folders.splice(index, 1);
    await writeKbStudioJson(externalSourcesPath, sources);
    app.log.info({ folder }, "Removed folder from KB Studio sources");
    return { ok: true, sources };
  });

  app.post("/api/admin/kb-studio/sources/url", async (req: any, reply) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return reply.code(400).send({ ok: false, error: "Missing URL" });
    }

    const sources = await readKbStudioJson(externalSourcesPath, app.log);
    if (!sources) {
      return reply.code(500).send({ ok: false, error: "Failed to read external_sources.json" });
    }

    if (!Array.isArray(sources.urls)) sources.urls = [];
    if (sources.urls.some((entry: any) => entry.url === url)) {
      return { ok: true, message: "URL already exists", sources };
    }

    sources.urls.push({ url, enabled: true });
    await writeKbStudioJson(externalSourcesPath, sources);
    app.log.info({ url }, "Added URL to KB Studio sources");
    return { ok: true, sources };
  });

  app.delete("/api/admin/kb-studio/sources/url", async (req: any, reply) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return reply.code(400).send({ ok: false, error: "Missing URL" });
    }

    const sources = await readKbStudioJson(externalSourcesPath, app.log);
    if (!sources) {
      return reply.code(500).send({ ok: false, error: "Failed to read external_sources.json" });
    }

    if (!Array.isArray(sources.urls)) sources.urls = [];
    const index = sources.urls.findIndex((entry: any) => entry.url === url);
    if (index === -1) {
      return { ok: true, message: "URL not found in sources", sources };
    }

    sources.urls.splice(index, 1);
    await writeKbStudioJson(externalSourcesPath, sources);
    app.log.info({ url }, "Removed URL from KB Studio sources");
    return { ok: true, sources };
  });

  app.get("/api/admin/kb-studio/manifest", async (_req, reply) => {
    const manifest = await readKbStudioJson(manifestPath, app.log);
    if (!manifest) {
      return reply.code(500).send({ ok: false, error: "Failed to read manifest.json" });
    }
    return { ok: true, manifest };
  });

  app.get("/api/admin/kb-studio/reports", async (_req, reply) => {
    try {
      const files = await fs.promises.readdir(reportsDir);
      const reports = [];

      for (const file of files) {
        if (!file.endsWith(".json")) continue;
        const content = await readKbStudioJson(path.join(reportsDir, file), app.log);
        if (content) {
          reports.push({ name: file, ...content });
        }
      }

      return { ok: true, reports };
    } catch (err: any) {
      app.log.error({ reportsDir, err }, "Failed to read KB Studio reports");
      return reply.code(500).send({ ok: false, error: err.message });
    }
  });

  app.post("/api/admin/kb-studio/scan", async (_req, reply) => {
    const inspection = await resolveAvailableKbRoot(options.kbStudioExportRoot, options.kbStudioImportRoot, app.log);
    if (!inspection) {
      return reply.code(404).send({ ok: false, error: "No generated WatanyBot KB manifest found", path: manifestPath });
    }
    return { ok: true, ...inspection };
  });

  app.post("/api/admin/kb-studio/ingest", async (_req, reply) => {
    const inspection = await resolveAvailableKbRoot(options.kbStudioExportRoot, options.kbStudioImportRoot, app.log);
    if (!inspection) {
      return reply.code(404).send({ ok: false, error: "No generated WatanyBot KB manifest found", path: manifestPath });
    }

    const sync = await syncKbStudioExport(inspection.exportRoot, options.kbStudioImportRoot);
    return { ok: true, inspection, sync };
  });

  app.post("/api/admin/kb-studio/export", async (_req, reply) => {
    const result = await runKbStudioCommand(
      "pnpm rebuild:watanybot",
      900000,
      "Starting KB Studio WatanyBot rebuild/export...",
      "KB Studio WatanyBot rebuild/export failed",
      app.log,
      options.kbStudioWorkspaceRoot,
    );

    if (!result.ok) {
      return reply.code(500).send(result);
    }

    const inspection = await inspectGeneratedKb(options.kbStudioExportRoot, app.log);
    return { ...result, inspection };
  });

  app.post("/api/admin/kb-studio/rebuild", async (_req, reply) => {
    const exportRebuild = await runKbStudioCommand(
      "pnpm rebuild:watanybot",
      900000,
      "Starting full KB Studio to WatanyBot rebuild...",
      "Full KB Studio to WatanyBot rebuild failed",
      app.log,
      options.kbStudioWorkspaceRoot,
    );

    const inspection = await resolveAvailableKbRoot(options.kbStudioExportRoot, options.kbStudioImportRoot, app.log);
    if (!inspection) {
      return reply.code(500).send({
        ok: false,
        error: exportRebuild.ok ? "Rebuild completed but manifest is missing" : "KB Studio rebuild failed and no existing export is available",
        exportRebuild,
      });
    }

    const usedExistingExport = !exportRebuild.ok;
    if (usedExistingExport) {
      app.log.warn({ preferredRoot: options.kbStudioExportRoot, fallbackRoot: inspection.exportRoot }, "Using latest available KB Studio export after rebuild command failure");
    }

    const sync = await syncKbStudioExport(inspection.exportRoot, options.kbStudioImportRoot);
    const backendRebuild = await rebuildBackendKbFromExport(options, inspection.exportRoot, app.log);
    if (!backendRebuild.ok) {
      return reply.code(500).send({ ok: false, exportRebuild, usedExistingExport, inspection, sync, backendRebuild });
    }

    return {
      ok: true,
      exportRebuild,
      usedExistingExport,
      inspection,
      sync,
      backendRebuild,
    };
  });
};