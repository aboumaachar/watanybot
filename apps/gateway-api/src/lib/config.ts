/**
 * Gateway environment configuration — all env-var parsing centralized here.
 * Extracted from server.ts top-level declarations.
 */
import path from "node:path";
import fs from "node:fs";

import { fileURLToPath } from "node:url";

const _filename = fileURLToPath(import.meta.url);
const _dirname = path.dirname(_filename);

function resolveConfiguredPath(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return path.isAbsolute(value) ? value : path.resolve(_dirname, value);
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

export const isDev = (process.env.NODE_ENV || "development") !== "production";
export const port = Number(process.env.PORT || 4000);
export const host = process.env.HOST || "0.0.0.0";
export const erpNextBaseUrl = process.env.ERPNEXT_BASE_URL || "http://127.0.0.1:18080";
export const erpNextSiteName = process.env.ERPNEXT_SITE_NAME || "frontend";
export const erpNextCredentialFile = resolveConfiguredPath(process.env.ERPNEXT_CREDENTIAL_FILE);
export const erpNextRequestTimeoutMs = Number(process.env.ERPNEXT_REQUEST_TIMEOUT_MS || "10000");

export const usePython = (process.env.USE_PYTHON_API || "true").toLowerCase() === "true";
let pythonBase = process.env.PYTHON_API_URL || "http://localhost:8010";
export function setPythonBase(v: string) { pythonBase = v; }
export function getPythonBase() { return pythonBase; }

export const useKbStub = (process.env.USE_KB_STUB || "true").toLowerCase() === "true";

// AI provider configuration
export const useAi = (process.env.USE_AI_PROVIDER || "false").toLowerCase() === "true";
export const aiBaseUrl = process.env.AI_BASE_URL || "https://api.openai.com/v1";
export const aiMaxTokens = Number(process.env.AI_MAX_TOKENS || "2048");
export const aiTemperature = Number(process.env.AI_TEMPERATURE || "0.3");
export const aiTimeoutMs = Number(process.env.AI_TIMEOUT_MS || "60000");
export const aiRagChunksPath = process.env.AI_RAG_CHUNKS_PATH || "";
export const aiRagTopK = Number(process.env.AI_RAG_TOP_K || "5");

export const aiSystemPrompt = process.env.AI_SYSTEM_PROMPT || `أنت "موطني" — مساعد افتراضي بخدمة العسكريين المتقاعدين وعيلهم.
أنت مساعد بأسلوب عسكري، ذكر، لهجتك لبنانية شبه رسمية ونبرتك محترمة وهادئة وداعمة.

قواعد المحادثة:
- احكي بالعربية اللبنانية شبه الرسمية — مش عامية كتير ومش فصحى جامدة
- كن مختصراً وواضحاً — جملتين لثلاث جمل بأغلب الردود
- عندما يسألك المستخدم صوتياً، أجب بأسلوب محادثة طبيعية وليس بقوائم أو جداول
- أظهر التعاطف والاهتمام — قول "بفهم عليك" أو "أكيد بساعدك"
- إذا ما كنت متأكد، قول هيك بصراحة ووجّه المستخدم للمصدر الصحيح
- ما تكرر السؤال حرفياً — أظهر إنك فهمته وجاوب مباشرة
- استخدم المعلومات من قاعدة المعرفة كمرجع بس صِغها بأسلوبك الطبيعي
- إذا كان الجواب يتعلق بمستندات أو خطوات، اذكرها بوضوح بس بشكل محادثة ومش كقائمة جامدة
- عند الحديث عن الرواتب أو الأرقام، كن دقيق واذكر المصدر
- بنهاية كل رد، قول "إذا بدك شي تاني أنا موجود لخدمتك." بشكل طبيعي

أنت بتمثل العسكريين المتقاعدين — كن محترم ومهني دائماً.`;

// Log level
export const LOG_LEVEL = process.env.LOG_LEVEL || (isDev ? "debug" : "info");

// Paths — resolved relative to gateway root
export const gatewayRoot = path.resolve(_dirname, "..");
export const repoRoot = path.resolve(_dirname, "../../../..");
export const projectxRoot = path.resolve(repoRoot, "..");

export function resolveRagPath(): string {
  if (!aiRagChunksPath) {
    return path.resolve(repoRoot, "watany_kb_tables_v4/watany_rag_chunks_v4.jsonl");
  }

  if (path.isAbsolute(aiRagChunksPath)) {
    return aiRagChunksPath;
  }

  return path.resolve(gatewayRoot, aiRagChunksPath);
}

export function resolveKbPath(): string {
  let kbPath = process.env.KB_SQLITE_PATH || "./data/kb.sqlite";
  const candidates = [
    path.resolve(_dirname, "../../../watany_kb_tables_v4/Watany_KB_v4.sqlite"),
    path.resolve(_dirname, "./data/kb.sqlite"),
  ];
  if (!process.env.KB_SQLITE_PATH || !fs.existsSync(kbPath)) {
    for (const c of candidates) {
      if (fs.existsSync(c)) { kbPath = c; break; }
    }
  }
  return kbPath;
}

export function resolveRuntimeKbPath(): string {
  let runtimeKbPath = process.env.RUNTIME_KB_JSON || "./data/kb/runtime_kb.json";
  const candidates = [
    path.resolve(_dirname, "../data/kb/runtime_kb.json"),
    path.resolve(repoRoot, "apps/runtime_kb.json"),
  ];
  if (!process.env.RUNTIME_KB_JSON || !fs.existsSync(runtimeKbPath)) {
    for (const c of candidates) {
      if (fs.existsSync(c)) { runtimeKbPath = c; break; }
    }
  }
  return runtimeKbPath;
}

export const dataDir = path.resolve(_dirname, "../../data");
export const kbSalariesDir = path.join(path.resolve(_dirname, "../../.."), "kb", "salaries");
export const kbStudioWorkspaceRoot = firstExistingPath([
  resolveConfiguredPath(process.env.KB_STUDIO_WORKSPACE_ROOT),
  path.resolve(projectxRoot, "kb-studio"),
  path.resolve(repoRoot, "kb_studio"),
]);
export const kbStudioRoot = firstExistingPath([
  resolveConfiguredPath(process.env.KB_STUDIO_META_ROOT),
  kbStudioWorkspaceRoot ? path.join(kbStudioWorkspaceRoot, ".kb_studio") : undefined,
  path.resolve(repoRoot, ".kb_studio"),
]);
export const kbStudioExportRoot = firstExistingPath([
  resolveConfiguredPath(process.env.KB_STUDIO_EXPORT_ROOT),
  kbStudioWorkspaceRoot ? path.join(kbStudioWorkspaceRoot, "runtime", "exports", "watanybot") : undefined,
  path.resolve(repoRoot, "kb_studio", "runtime", "exports", "watanybot"),
]);
export const kbStudioImportRoot = firstExistingPath([
  resolveConfiguredPath(process.env.KB_STUDIO_IMPORT_ROOT),
  path.resolve(repoRoot, "kb_studio", "runtime", "exports", "watanybot"),
  kbStudioExportRoot,
]);
export const pluginDbPath = process.env.PLUGIN_DB_PATH || "./data/plugins.sqlite";
export const disablePluginDb = (process.env.DISABLE_PLUGIN_DB || "false").toLowerCase() === "true";
export const disableKbNodes = (process.env.DISABLE_KB_NODES || "false").toLowerCase() === "true";
export const disableWebsockets = (process.env.DISABLE_WEBSOCKETS || "false").toLowerCase() === "true";

function resolveKbNodesDbPath(): string {
  const configuredPath = process.env.KB_NODES_DB_PATH;
  const candidates = [
    configuredPath,
    kbStudioExportRoot ? path.join(kbStudioExportRoot, "kb_nodes.db") : undefined,
    kbStudioImportRoot ? path.join(kbStudioImportRoot, "kb_nodes.db") : undefined,
    path.resolve(_dirname, "../../../kb-studio/runtime/exports/watanybot/kb_nodes.db"),
    path.resolve(_dirname, "../../../kb_studio/runtime/exports/watanybot/kb_nodes.db"),
    path.resolve(process.cwd(), "../kb-studio/runtime/exports/watanybot/kb_nodes.db"),
    path.resolve(process.cwd(), "../../kb-studio/runtime/exports/watanybot/kb_nodes.db"),
  ].filter((candidate): candidate is string => Boolean(candidate));

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return candidates[0];
}

// Circuit breaker env config
export const kbCbThreshold = Number(process.env.KB_CB_THRESHOLD || "5");
export const kbCbTimeout = Number(process.env.KB_CB_TIMEOUT || "30000");
export const pythonCbThreshold = Number(process.env.PYTHON_CB_THRESHOLD || "5");
export const pythonCbTimeout = Number(process.env.PYTHON_CB_TIMEOUT || "30000");
export const aiCbThreshold = Number(process.env.AI_CB_THRESHOLD || "3");
export const aiCbTimeout = Number(process.env.AI_CB_TIMEOUT || "60000");

// AI training
export const trainingDir = path.join(dataDir, "ai_training");
export const trainingFilePath = process.env.AI_TRAINING_FILE || path.join(trainingDir, "training.jsonl");

// KB vNext
export const kbNodesDbPath = resolveKbNodesDbPath();
