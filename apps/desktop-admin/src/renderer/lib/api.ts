/**
 * Gateway API client — uses Electron IPC when available, falls back to fetch.
 */

const GATEWAY = "http://127.0.0.1:8010";

async function gw(
  method: string,
  path: string,
  body?: unknown
): Promise<any> {
  const bodyStr = body ? JSON.stringify(body) : undefined;

  // Electron desktop mode
  if (window.electronAPI?.gatewayFetch) {
    const res = await window.electronAPI.gatewayFetch(method, path, bodyStr);
    if (res.status >= 400) {
      const errorMsg = res.data?.error || res.data?.message || JSON.stringify(res.data);
      throw new Error(`HTTP ${res.status}: ${errorMsg}`);
    }
    return res.data;
  }

  // Browser fallback (dev mode with Vite)
  const res = await fetch(`${GATEWAY}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: bodyStr,
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const errorMsg = errorData?.error || errorData?.message || res.statusText;
    throw new Error(`HTTP ${res.status}: ${errorMsg}`);
  }
  return res.json();
}

/* ── Admin ────────────────────────────────────────────── */
export const getOverview = () => gw("GET", "/api/admin/overview");
export const getPluginStats = () => gw("GET", "/api/admin/plugins");
export const getVoiceChecks = () => gw("GET", "/api/admin/voice-checks");
export const runVoiceCheck = () => gw("POST", "/api/admin/voice-checks/run");
export const getVoiceConfig = () => gw("GET", "/api/admin/voice-config");
export const saveVoiceConfig = (cfg: any) =>
  gw("POST", "/api/admin/voice-config", cfg);

/* ── Admin KB Rules ───────────────────────────────────── */
export const getKBRules = () => gw("GET", "/api/admin/kb/rules");
export const updateKBRules = (patch: any) =>
  gw("PATCH", "/api/admin/kb/rules", patch);
export const getSalaryEntries = (rank = "", page = 1, pageSize = 50) =>
  gw("GET", `/api/admin/kb/salary-entries?rank=${encodeURIComponent(rank)}&page=${page}&pageSize=${pageSize}`);
export const getSalaryEntry = (key: string) =>
  gw("GET", `/api/admin/kb/salary-entry/${encodeURIComponent(key)}`);
export const updateSalaryEntry = (key: string, patch: any) =>
  gw("PATCH", `/api/admin/kb/salary-entry/${encodeURIComponent(key)}`, patch);
export const saveKB = () => gw("POST", "/api/admin/kb/save");
export const reloadKB = () => gw("POST", "/api/admin/kb/reload");
export const recalculateKB = () => gw("POST", "/api/admin/kb/recalculate");

/* ── KB / Salary ──────────────────────────────────────── */
export const getSalaryMeta = () => gw("GET", "/api/salary/meta");
export const salaryLookup = (rank: string, degree: number) =>
  gw("GET", `/api/salary?rank=${encodeURIComponent(rank)}&degree=${degree}`);
export const salaryCalc = (params: any) =>
  gw("POST", "/api/salary/calc", params);
export const searchTx = (q: string) =>
  gw("GET", `/api/tx/search?q=${encodeURIComponent(q)}`);
export const getTx = (id: string) =>
  gw("GET", `/api/tx/${encodeURIComponent(id)}`);

/* ── Runtime KB (runtime_kb.json) ───────────────────── */
export const getRuntimeKB = () => gw("GET", "/api/admin/kb/runtime");
export const saveRuntimeKB = (kb: any) => gw("POST", "/api/admin/kb/runtime-save", kb);
export const reloadRuntimeKBPreview = () => gw("POST", "/api/admin/kb/runtime-reload");

/* Versions & RAG Chunks */
export const listKBVersions = (file?: string) => gw("GET", `/api/admin/kb/versions${file ? `?file=${encodeURIComponent(file)}` : ''}`);
export const rollbackKBVersion = (id: string) => gw("POST", "/api/admin/kb/versions/rollback", { id });
export const listRagChunks = (q = '', page = 1, pageSize = 50) => gw("GET", `/api/admin/kb/chunks?q=${encodeURIComponent(q)}&page=${page}&pageSize=${pageSize}`);
export const getRagChunk = (id: string) => gw("GET", `/api/admin/kb/chunk/${encodeURIComponent(id)}`);
export const updateRagChunk = (id: string, patch: any) => gw("PATCH", `/api/admin/kb/chunk/${encodeURIComponent(id)}`, patch);
export const saveRagChunks = () => gw("POST", "/api/admin/kb/chunks/save");
export const reloadRagChunks = () => gw("POST", "/api/admin/kb/chunks/reload");
export const rebuildAi = () => gw("POST", "/api/admin/ai/rebuild");
export const getAiTraining = () => gw("GET", "/api/admin/ai/training");
export const addAiTraining = (ex: any) => gw("POST", "/api/admin/ai/training", ex);
export const exportAiTraining = () => gw("GET", "/api/admin/ai/training/export");
export const publishAiTraining = () => gw("POST", "/api/admin/ai/training/publish");
export const getPendingTraining = () => gw("GET", "/api/admin/ai/training?status=pending");
export const approveTraining = (id: string) => gw("POST", `/api/admin/ai/training/${encodeURIComponent(id)}/approve`);
export const rejectTraining = (id: string) => gw("POST", `/api/admin/ai/training/${encodeURIComponent(id)}/reject`);
export const deleteTraining = (id: string) => gw("DELETE", `/api/admin/ai/training/${encodeURIComponent(id)}`);
export const importFeedbackTraining = (items: any[]) => gw("POST", "/api/admin/ai/training/import-feedback", { items });
export const prepareFineTune = () => gw("POST", "/api/admin/ai/fine-tune");

/* AI / Python admin */
export const getAiConfig = () => gw("GET", "/api/admin/ai-config");
export const setAiConfig = (cfg: any) => gw("POST", "/api/admin/ai-config", cfg);
export const probePython = (base: string) => gw("POST", "/api/admin/python/probe", { base });

/* ── Cases / Tickets ──────────────────────────────────── */
export const getCases = () => gw("GET", "/api/cases");
export const createCase = (data: any) => gw("POST", "/api/cases", data);
export const updateCase = (id: string, patch: any) =>
  gw("PATCH", `/api/cases/${id}`, patch);

// Chat sessions for hybrid support
export const getChatSessions = () => gw("GET", "/api/chat-sessions");
export const getChatSession = (id: string) =>
  gw("GET", `/api/chat-sessions/${id}`);
export const updateChatSession = (id: string, patch: any) =>
  gw("PATCH", `/api/chat-sessions/${id}`, patch);
export const createChatSession = (data: any) =>
  gw("POST", "/api/chat-sessions", data);

/* ── Documents ────────────────────────────────────────── */
export const getDocuments = () => gw("GET", "/api/documents");
export const addDocument = (doc: any) => gw("POST", "/api/documents", doc);
export const updateDocument = (id: string, patch: any) =>
  gw("PATCH", `/api/documents/${id}`, patch);

/* ── Notifications ────────────────────────────────────── */
export const getNotifications = () => gw("GET", "/api/notifications");
export const markNotification = (id: string, read: boolean) =>
  gw("PATCH", `/api/notifications/${id}`, { read });
export const clearNotifications = () =>
  gw("POST", "/api/notifications/clear");

/* ── Chat / History ───────────────────────────────────── */
export const chat = (message: string) =>
  gw("POST", "/api/chat", { message, channel: "web" });
export const getHistory = () => gw("GET", "/api/history?limit=200");

/* ── Saved Chats ──────────────────────────────────────── */
export const getSavedChats = () => gw("GET", "/api/saved");
export const saveChat = (text: string) => gw("POST", "/api/saved", { text });
export const removeSavedChat = (id: string) => gw("DELETE", `/api/saved/${id}`);

/* ── Jobs ─────────────────────────────────────────────── */
export const searchJobs = (q: string) =>
  gw("GET", `/api/plugins/jobs?q=${encodeURIComponent(q)}`);

/* ── Marketplace ──────────────────────────────────────── */
export const listMarketplace = () => gw("GET", "/api/plugins/marketplace");
export const createListing = (data: any) =>
  gw("POST", "/api/plugins/marketplace", data);

/* ── Emergency Alerts ─────────────────────────────────── */
export const getEmergencyAlerts = (q = "") =>
  gw("GET", `/api/plugins/emergency?q=${encodeURIComponent(q)}`);

/* ── Profile ──────────────────────────────────────────── */
export const getProfile = () => gw("GET", "/api/profile");
export const updateProfile = (patch: any) =>
  gw("PATCH", "/api/profile", patch);

/* ── Health ───────────────────────────────────────────── */
export const health = () => gw("GET", "/health");

/* ── KB Studio ────────────────────────────────────────── */
export const getKBStudioSources = () => gw("GET", "/api/admin/kb-studio/sources");
export const addKBStudioFolder = (folder: string) => gw("POST", "/api/admin/kb-studio/sources/folder", { folder });
export const removeKBStudioFolder = (folder: string) => gw("DELETE", "/api/admin/kb-studio/sources/folder", { folder });
export const addKBStudioUrl = (url: string) => gw("POST", "/api/admin/kb-studio/sources/url", { url });
export const removeKBStudioUrl = (url: string) => gw("DELETE", "/api/admin/kb-studio/sources/url", { url });
export const getKBStudioManifest = () => gw("GET", "/api/admin/kb-studio/manifest");
export const getKBStudioReports = () => gw("GET", "/api/admin/kb-studio/reports");
export const triggerKBScan = () => gw("POST", "/api/admin/kb-studio/scan");
export const triggerKBIngest = () => gw("POST", "/api/admin/kb-studio/ingest");
export const triggerKBExport = () => gw("POST", "/api/admin/kb-studio/export");
export const triggerKBFullRebuild = () => gw("POST", "/api/admin/kb-studio/rebuild");
/* ── AI Training & Feedback ──────────────────────────── */
export const getFeedbackQueue = () => gw("GET", "/api/admin/ai/feedback-queue");
export const getFeedback = (id: string) => gw("GET", `/api/admin/ai/feedback/${encodeURIComponent(id)}`);
export const addFeedback = (data: any) => gw("POST", "/api/admin/ai/feedback", data);
export const approveFeedback = (id: string) => gw("POST", `/api/admin/ai/feedback/${encodeURIComponent(id)}/approve`);
export const rejectFeedback = (id: string) => gw("POST", `/api/admin/ai/feedback/${encodeURIComponent(id)}/reject`);
export const deleteFeedback = (id: string) => gw("DELETE", `/api/admin/ai/feedback/${encodeURIComponent(id)}`);