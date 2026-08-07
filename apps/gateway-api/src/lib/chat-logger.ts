/**
 * Chat input logging and UX intelligence.
 *
 * Manages four persistent data stores:
 *   - chat-inputs.jsonl          — raw timestamped chat input log
 *   - question-clusters.json     — repeated question groupings / most-asked
 *   - admin-answer-overrides.json — curated answers added by admin
 *   - abusive-chat-events.jsonl  — abuse / violation events
 */
import fs from "node:fs";
import path from "node:path";

let _dataDir = "";

export function initChatLogger(dataDir: string): void {
  _dataDir = dataDir;
  ensureJsonlFile(chatInputsPath());
  ensureJsonFile(questionClustersPath(), { clusters: [] });
  ensureJsonFile(adminAnswerOverridesPath(), []);
  ensureJsonlFile(abusiveChatEventsPath());
}

// ── File paths ────────────────────────────────────────────────────────────────

function chatInputsPath(): string {
  return path.resolve(_dataDir, "chat-inputs.jsonl");
}
function questionClustersPath(): string {
  return path.resolve(_dataDir, "question-clusters.json");
}
function adminAnswerOverridesPath(): string {
  return path.resolve(_dataDir, "admin-answer-overrides.json");
}
function abusiveChatEventsPath(): string {
  return path.resolve(_dataDir, "abusive-chat-events.jsonl");
}

function ensureJsonlFile(p: string): void {
  try {
    if (!fs.existsSync(p)) fs.writeFileSync(p, "", "utf8");
  } catch { /* ignore */ }
}

function ensureJsonFile(p: string, defaultValue: unknown): void {
  try {
    if (!fs.existsSync(p)) fs.writeFileSync(p, JSON.stringify(defaultValue, null, 2), "utf8");
  } catch { /* ignore */ }
}

// ── Chat input log ────────────────────────────────────────────────────────────

export interface ChatInputEntry {
  id: string;
  ts: string;
  message: string;
  normalized: string;
  userId: string;
  channel: string;
  module?: string;
  confidence?: number;
  unanswered?: boolean;
}

export function logChatInput(entry: Omit<ChatInputEntry, "id">): string {
  if (!_dataDir) return "";
  const id = `ci-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const full: ChatInputEntry = { id, ...entry };
  try {
    fs.appendFileSync(chatInputsPath(), JSON.stringify(full) + "\n", "utf8");
    _updateQuestionClusters(full);
  } catch (err) {
    console.warn("[chat-logger] Failed to write chat-inputs:", err);
  }
  return id;
}

export function readChatInputs(limit = 100): ChatInputEntry[] {
  try {
    const p = chatInputsPath();
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
    return lines
      .map((l) => { try { return JSON.parse(l) as ChatInputEntry; } catch { return null; } })
      .filter((x): x is ChatInputEntry => x !== null)
      .reverse()
      .slice(0, limit);
  } catch { return []; }
}

export function clearChatInputs(): void {
  try { fs.writeFileSync(chatInputsPath(), "", "utf8"); } catch { /* ignore */ }
}

// ── Question clusters ─────────────────────────────────────────────────────────

export interface QuestionCluster {
  id: string;
  normalizedKey: string;
  count: number;
  lastSeen: string;
  samples: string[];
  module?: string;
  unanswered: boolean;
  adminOverrideId?: string;
}

interface ClustersData {
  clusters: QuestionCluster[];
}

function _readClusters(): ClustersData {
  try {
    const p = questionClustersPath();
    if (!fs.existsSync(p)) return { clusters: [] };
    return JSON.parse(fs.readFileSync(p, "utf8")) as ClustersData;
  } catch { return { clusters: [] }; }
}

function _writeClusters(data: ClustersData): void {
  try { fs.writeFileSync(questionClustersPath(), JSON.stringify(data, null, 2), "utf8"); } catch { /* ignore */ }
}

function _normalizeForCluster(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 80);
}

function _updateQuestionClusters(entry: ChatInputEntry): void {
  try {
    const key = _normalizeForCluster(entry.normalized || entry.message);
    const data = _readClusters();
    const existing = data.clusters.find((c) => c.normalizedKey === key);
    if (existing) {
      existing.count += 1;
      existing.lastSeen = entry.ts;
      if (!existing.samples.includes(entry.message) && existing.samples.length < 5) {
        existing.samples.push(entry.message);
      }
      if (entry.module) existing.module = entry.module;
      if (entry.unanswered !== undefined) existing.unanswered = entry.unanswered;
    } else {
      const id = `qc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      data.clusters.push({
        id,
        normalizedKey: key,
        count: 1,
        lastSeen: entry.ts,
        samples: [entry.message],
        module: entry.module,
        unanswered: entry.unanswered ?? false,
      });
    }
    _writeClusters(data);
  } catch (err) {
    console.warn("[chat-logger] Failed to update question-clusters:", err);
  }
}

export function readQuestionClusters(opts?: {
  sort?: "count" | "recent";
  limit?: number;
  unanswered?: boolean;
}): QuestionCluster[] {
  const data = _readClusters();
  let items = data.clusters;
  if (opts?.unanswered) items = items.filter((c) => c.unanswered);
  if (opts?.sort === "count") {
    items = [...items].sort((a, b) => b.count - a.count);
  } else {
    items = [...items].sort((a, b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime());
  }
  return items.slice(0, opts?.limit ?? 100);
}

// ── Admin answer overrides ────────────────────────────────────────────────────

export interface AdminAnswerOverride {
  id: string;
  clusterId?: string;
  matchPattern: string;
  answer: string;
  sourceUrl?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

function _readOverrides(): AdminAnswerOverride[] {
  try {
    const p = adminAnswerOverridesPath();
    if (!fs.existsSync(p)) return [];
    return JSON.parse(fs.readFileSync(p, "utf8")) as AdminAnswerOverride[];
  } catch { return []; }
}

function _writeOverrides(items: AdminAnswerOverride[]): void {
  try { fs.writeFileSync(adminAnswerOverridesPath(), JSON.stringify(items, null, 2), "utf8"); } catch { /* ignore */ }
}

export function createAdminAnswerOverride(
  data: Omit<AdminAnswerOverride, "id" | "createdAt" | "updatedAt">,
): AdminAnswerOverride {
  const id = `ov-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  const item: AdminAnswerOverride = { id, ...data, createdAt: now, updatedAt: now };
  const all = _readOverrides();
  all.push(item);
  _writeOverrides(all);
  return item;
}

export function readAdminAnswerOverrides(activeOnly = false): AdminAnswerOverride[] {
  const all = _readOverrides();
  return activeOnly ? all.filter((o) => o.active) : all;
}

export function updateAdminAnswerOverride(
  id: string,
  patch: Partial<Pick<AdminAnswerOverride, "answer" | "sourceUrl" | "active">>,
): AdminAnswerOverride | null {
  const all = _readOverrides();
  const idx = all.findIndex((o) => o.id === id);
  if (idx === -1) return null;
  all[idx] = { ...all[idx], ...patch, updatedAt: new Date().toISOString() };
  _writeOverrides(all);
  return all[idx];
}

export function deleteAdminAnswerOverride(id: string): boolean {
  const all = _readOverrides();
  const filtered = all.filter((o) => o.id !== id);
  if (filtered.length === all.length) return false;
  _writeOverrides(filtered);
  return true;
}

// ── Abusive chat events ───────────────────────────────────────────────────────

export interface AbusiveChatEvent {
  id: string;
  ts: string;
  userId: string;
  channel: string;
  message: string;
  reason: string;
  severity: "low" | "medium" | "high";
  dismissed?: boolean;
}

export function logAbusiveChatEvent(entry: Omit<AbusiveChatEvent, "id">): string {
  if (!_dataDir) return "";
  const id = `ab-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const full: AbusiveChatEvent = { id, ...entry };
  try {
    fs.appendFileSync(abusiveChatEventsPath(), JSON.stringify(full) + "\n", "utf8");
  } catch (err) {
    console.warn("[chat-logger] Failed to write abusive-chat-events:", err);
  }
  return id;
}

export function readAbusiveChatEvents(limit = 100): AbusiveChatEvent[] {
  try {
    const p = abusiveChatEventsPath();
    if (!fs.existsSync(p)) return [];
    const lines = fs.readFileSync(p, "utf8").split("\n").filter(Boolean);
    return lines
      .map((l) => { try { return JSON.parse(l) as AbusiveChatEvent; } catch { return null; } })
      .filter((x): x is AbusiveChatEvent => x !== null)
      .reverse()
      .slice(0, limit);
  } catch { return []; }
}
