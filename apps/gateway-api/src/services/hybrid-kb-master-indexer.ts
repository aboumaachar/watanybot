import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type HybridKbIndexCategory = "kb" | "procedure" | "faq" | "data" | "feature" | "document" | "source";

export type HybridKbIndexRecord = Readonly<{
  id: string;
  title: string;
  category: HybridKbIndexCategory | string;
  relativePath: string;
  route?: string;
  extension?: string;
  sizeBytes?: number;
  lastModifiedUtc?: string;
  sha256?: string;
  keywords?: readonly string[];
  preview?: string;
}>;

export type HybridKbMasterIndex = Readonly<{
  schemaVersion: number;
  generatedAt: string;
  generator?: string;
  generatorVersion?: string;
  projectRootHint?: string;
  recordCount: number;
  categories?: Record<string, number>;
  records: readonly HybridKbIndexRecord[];
}>;

const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  ".git",
  ".pma",
  ".apex",
  ".apex-backups",
  "backups",
  "dist",
  "build",
  ".next",
  "coverage",
]);

const INCLUDED_EXTENSIONS = new Set([".md", ".mdx", ".json", ".ts", ".tsx", ".js", ".jsx", ".txt", ".csv", ".yaml", ".yml"]);

export function resolveWatanyProjectRoot(): string {
  if (process.env.WATANYBOT_PROJECT_ROOT) {
    return path.resolve(process.env.WATANYBOT_PROJECT_ROOT);
  }

  const cwd = process.cwd();
  if (cwd.endsWith(path.join("apps", "gateway-api"))) {
    return path.resolve(cwd, "..", "..");
  }

  return cwd;
}

export function getHybridKbMasterIndexPath(projectRoot = resolveWatanyProjectRoot()): string {
  return path.join(projectRoot, "apps", "gateway-api", "data", "hybrid-kb", "hybrid-kb-master-index.json");
}

function isExcluded(filePath: string): boolean {
  return filePath.split(/[\\/]+/).some((part) => EXCLUDED_SEGMENTS.has(part));
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function classify(relativePath: string, preview: string): HybridKbIndexCategory {
  const haystack = `${relativePath} ${preview}`.toLowerCase();
  if (/procedure|procedures|forms|إجراء|معاملة/.test(haystack)) return "procedure";
  if (/faq|frequently|سؤال|أسئلة/.test(haystack)) return "faq";
  if (/kb|knowledge|hybrid-kb|معرفة/.test(haystack)) return "kb";
  if (/data|\.json/.test(haystack)) return "data";
  if (/pages|components|routes/.test(haystack)) return "feature";
  if (/docs|document|مستند/.test(haystack)) return "document";
  return "source";
}

function extractTitle(relativePath: string, preview: string): string {
  const markdownHeading = preview.match(/#\s+([^#\n\r]{2,120})/);
  if (markdownHeading?.[1]) return markdownHeading[1].trim();

  const jsonTitle = preview.match(/"(?:title|titleAr|label|labelAr)"\s*:\s*"([^"]{2,120})"/);
  if (jsonTitle?.[1]) return jsonTitle[1].trim();

  return path.basename(relativePath, path.extname(relativePath));
}

function keywordsFor(relativePath: string, preview: string): string[] {
  const haystack = `${relativePath} ${preview}`.toLowerCase();
  const candidates: Array<readonly [string, string]> = [
    ["salary", "راتب"],
    ["pension", "معاش"],
    ["compensation", "تعويض"],
    ["procedure", "إجراء"],
    ["forms", "نماذج"],
    ["faq", "أسئلة"],
    ["health", "استشفاء"],
    ["jobs", "وظائف"],
    ["market", "سوق"],
    ["community", "مجتمع"],
    ["payment", "دفع"],
    ["kb", "معرفة"],
  ];

  const found = new Set<string>();
  for (const [en, ar] of candidates) {
    if (haystack.includes(en) || haystack.includes(ar.toLowerCase())) {
      found.add(en);
      found.add(ar);
    }
  }

  return [...found];
}

async function walkFiles(root: string, start: string, output: string[]): Promise<void> {
  let entries: Array<import("node:fs").Dirent> = [];
  try {
    entries = await fs.readdir(start, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(start, entry.name);
    const relativePath = path.relative(root, fullPath);
    if (isExcluded(relativePath)) continue;

    if (entry.isDirectory()) {
      await walkFiles(root, fullPath, output);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!INCLUDED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) continue;
    output.push(fullPath);
  }
}

export async function buildHybridKbMasterIndex(projectRoot = resolveWatanyProjectRoot()): Promise<HybridKbMasterIndex> {
  const roots = [
    "apps/gateway-api/data",
    "apps/gateway-api/src/data",
    "apps/gateway-api/docs",
    "apps/web-user/src/pages",
    "apps/web-user/src/components",
    "apps/web-user/src/lib",
    "apps/web-user/src/data",
    "data",
    "docs",
    "kb",
    "public",
  ];

  const files: string[] = [];
  for (const root of roots) {
    await walkFiles(projectRoot, path.join(projectRoot, root), files);
  }

  const uniqueFiles = [...new Set(files)];
  const records: HybridKbIndexRecord[] = [];

  for (let index = 0; index < uniqueFiles.length; index += 1) {
    const filePath = uniqueFiles[index];
    let stat;
    let content = "";
    try {
      stat = await fs.stat(filePath);
      content = await fs.readFile(filePath, "utf8");
    } catch {
      continue;
    }

    const preview = normalizeWhitespace(content).slice(0, 900);
    const relativePath = path.relative(projectRoot, filePath).replace(/\\/g, "/");
    const hash = crypto.createHash("sha256").update(content).digest("hex");
    const category = classify(relativePath, preview);

    records.push({
      id: `hybrid-index-${String(index + 1).padStart(6, "0")}`,
      title: extractTitle(relativePath, preview),
      category,
      relativePath,
      route: relativePath.includes("apps/web-user/src/pages/") ? inferRoute(relativePath) : "",
      extension: path.extname(filePath).toLowerCase(),
      sizeBytes: stat.size,
      lastModifiedUtc: stat.mtime.toISOString(),
      sha256: hash,
      keywords: keywordsFor(relativePath, preview),
      preview,
    });
  }

  const categories: Record<string, number> = {};
  for (const record of records) {
    categories[record.category] = (categories[record.category] ?? 0) + 1;
  }

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    generator: "gateway-runtime",
    generatorVersion: "v1.0",
    projectRootHint: projectRoot,
    recordCount: records.length,
    categories,
    records,
  };
}

function inferRoute(relativePath: string): string {
  const base = path.basename(relativePath, path.extname(relativePath));
  if (base === "hybrid-kb-chat") return "/hybrid-kb-chat";
  if (base === "index") return "/";
  const clean = base.endsWith("Page") ? base.slice(0, -4) : base;
  return `/${clean.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase()}`;
}

export async function writeHybridKbMasterIndex(projectRoot = resolveWatanyProjectRoot()): Promise<HybridKbMasterIndex> {
  const index = await buildHybridKbMasterIndex(projectRoot);
  const outPath = getHybridKbMasterIndexPath(projectRoot);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, JSON.stringify(index, null, 2), "utf8");
  return index;
}

export async function loadHybridKbMasterIndex(projectRoot = resolveWatanyProjectRoot()): Promise<HybridKbMasterIndex> {
  const outPath = getHybridKbMasterIndexPath(projectRoot);
  try {
    const raw = await fs.readFile(outPath, "utf8");
    return JSON.parse(raw) as HybridKbMasterIndex;
  } catch {
    return writeHybridKbMasterIndex(projectRoot);
  }
}

export function searchHybridKbMasterIndex(index: HybridKbMasterIndex, query: string, limit = 25): HybridKbIndexRecord[] {
  const q = normalizeWhitespace(query).toLowerCase();
  if (!q) return index.records.slice(0, limit) as HybridKbIndexRecord[];

  return index.records
    .map((record) => {
      const haystack = [record.title, record.category, record.relativePath, record.route, ...(record.keywords ?? []), record.preview]
        .join(" ")
        .toLowerCase();
      const score = haystack.includes(q) ? 100 : q.split(" ").filter((token) => token && haystack.includes(token)).length;
      return { record, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((entry) => entry.record);
}