/** Static fallback (used by legacy imports). Live code should call getApiUrl() instead. */
const LOCAL_ADMIN_API_URL = import.meta.env.VITE_LOCAL_ADMIN_API_URL || "http://127.0.0.1:8099";
export const API = import.meta.env.VITE_API_URL || LOCAL_ADMIN_API_URL;

/** Returns the currently active admin API base URL (respects runtime server switch). */
export function getApiUrl(): string {
  const storedUrl = localStorage.getItem("admin_api_url");
  if (storedUrl === "http://localhost:8010") {
    localStorage.setItem("admin_api_url", LOCAL_ADMIN_API_URL);
    return LOCAL_ADMIN_API_URL;
  }
  if (import.meta.env.DEV && storedUrl?.startsWith("https://koudama.com/")) {
    return API;
  }
  return storedUrl || API;
}

export const SERVERS = [
  { label: "Local", url: LOCAL_ADMIN_API_URL },
  { label: "Production (koudama.com)", url: "https://koudama.com/mcp" },
] as const;

const CSRF_COOKIE_KEY = "watany_csrf";

export type FeatureFlagsResponse = {
  flags: Record<string, boolean>;
  lastUpdatedAt: string | null;
};

export type AdminAuthority = {
  actorId: string;
  email: string;
  roles: string[];
  isSuperadmin: boolean;
  permissions: string[];
};

export type AdminProfile = {
  id: string;
  email: string;
  role: string;
  status: string;
};

export type AdminSession = {
  authenticated: boolean;
  actorId: string;
  roles: readonly string[];
  capabilities: readonly string[];
};

export function hasAdminCapability(session: AdminSession | null, capability: string): boolean {
  return !!session?.authenticated && session.capabilities.includes(capability);
}

export type CommunityGroup = {
  id: string;
  name: string;
  description?: string | null;
  memberCount?: number;
};

export async function listCommunityGroups(): Promise<CommunityGroup[]> {
  const response = await adminFetch("/api/community/groups");
  const data = await response.json() as { groups?: CommunityGroup[] };
  return Array.isArray(data.groups) ? data.groups : [];
}

export type NetworkVisibilityLevel = "VISIBLE_PUBLIC" | "VISIBLE_NETWORK_ONLY" | "VISIBLE_CAZA_ONLY" | "VISIBLE_VILLAGE_ONLY" | "HIDDEN";
export type NetworkApprovalStatus = "PENDING" | "APPROVED" | "SUSPENDED" | "HIDDEN_BY_ADMIN";
export type NetworkFamilyTier = "BASIC_FAMILY_MEMBER" | "VERIFIED_FAMILY_MEMBER" | "CONTRIBUTOR" | "COMMUNITY_STEWARD";
export type NetworkProfile = {
  id: string;
  userId: string;
  displayName: string;
  address: { governorateId?: string; cazaId?: string; municipalityId?: string; villageId?: string; latitude?: number; longitude?: number };
  visibilityLevel: NetworkVisibilityLevel;
  familyTier?: NetworkFamilyTier;
  points?: number;
  isVerifiedUser?: boolean;
  approvalStatus: NetworkApprovalStatus;
  isActive: boolean;
  createdAt: string;
  submittedAt?: string;
  approvedAt?: string;
  updatedAt: string;
};
export type NetworkSettings = {
  featureEnabled: boolean;
  requireApproval: boolean;
  defaultVisibilityLevel: NetworkVisibilityLevel;
  gpsEnabled: boolean;
  mapEnabled: boolean;
  connectionsEnabled: boolean;
};

export async function getNetworkSettings(): Promise<NetworkSettings> {
  const response = await adminFetch("/api/network/settings");
  const data = await response.json() as { settings?: NetworkSettings };
  if (!data.settings) throw new AdminApiError("Network settings are missing", { kind: "http", status: 502 });
  return data.settings;
}

export async function listNetworkProfiles(): Promise<NetworkProfile[]> {
  const response = await adminFetch("/api/network/map");
  const data = await response.json() as { profiles?: NetworkProfile[] };
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export async function searchNetworkProfiles(filters: { governorateId?: string; cazaId?: string; municipalityId?: string; villageId?: string } = {}): Promise<NetworkProfile[]> {
  const query = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) query.set(key, value); });
  const suffix = query.toString();
  const response = await adminFetch(`/api/network/search${suffix ? "?" + suffix : ""}`);
  const data = await response.json() as { profiles?: NetworkProfile[] };
  return Array.isArray(data.profiles) ? data.profiles : [];
}

export async function getAdminAuthorityMe(): Promise<AdminAuthority> {
  const res = await adminFetch("/api/admin-authority/me");
  const data = await res.json() as { authority?: AdminAuthority };
  if (!data.authority) {
    throw new AdminApiError("Authority response is missing", { kind: "http", status: 502 });
  }
  return data.authority;
}

export function getPayloadCmsOrigin(): string {
  const configured = String(import.meta.env.VITE_PAYLOAD_CMS_URL || "").trim().replace(/\/+$/u, "");
  if (configured) return configured;
  const hostname = typeof globalThis.location === "undefined" ? "" : globalThis.location.hostname;
  if (hostname === "koudama.com" || hostname.endsWith(".koudama.com")) return "https://payload.koudama.com";
  return "http://127.0.0.1:4100";
}

export async function openPayloadContentStudio(): Promise<void> {
  const response = await adminFetch("/api/admin/payload-sso", { method: "POST" });
  const data = await response.json() as { assertion?: string };
  if (!data.assertion) throw new AdminApiError("Payload SSO assertion is missing", { kind: "http", status: 502 });

  const payloadOrigin = getPayloadCmsOrigin();
  const exchange = await fetch(`${payloadOrigin}/api/gateway-sso/exchange`, {
    method: "POST",
    redirect: "manual",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.assertion}` },
    credentials: "include",
    body: JSON.stringify({ assertion: data.assertion }),
  });
  const acceptedManualRedirect = exchange.status === 0 && exchange.type === "opaqueredirect";
  if (!exchange.ok && !acceptedManualRedirect && (exchange.status < 300 || exchange.status >= 400)) throw new AdminApiError(`Payload SSO exchange failed: HTTP ${exchange.status}`, { kind: "http", status: exchange.status });

  globalThis.location.assign(`${payloadOrigin}/admin`);
}

export async function getAdminProfile(): Promise<AdminProfile> {
  const res = await adminFetch("/api/auth/me");
  const data = await res.json() as { user?: AdminProfile };
  if (!data.user) {
    throw new AdminApiError("Profile response is missing", { kind: "http", status: 502 });
  }
  return data.user;
}

export type WebUserSettingsResponse = {
  settings: import("@watany/shared/web-user-settings").PublishedWebUserSettings;
  lastUpdatedAt: string | null;
};

export type RecruitmentAnnouncementStatus = "draft" | "published" | "expired" | "cancelled";

export type RecruitmentAnnouncement = {
  id: string;
  title: string;
  apparatusName: string;
  announcementNumber?: string;
  startDate?: string;
  endDate?: string;
  status: RecruitmentAnnouncementStatus;
  conditions: string[];
  requiredDocuments: string[];
  eligibleCategories: string[];
  applicationLocation?: string;
  applicationMethod?: string;
  sourceName?: string;
  sourceUrl?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type SeasonalApplication = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  age: number | string;
  gender?: string;
  relationType: string;
  governorate: string;
  governorateAr?: string;
  caza: string;
  cazaAr?: string;
  village: string;
  villageAr?: string;
  availability: string;
  preferredPeriod?: string;
  weekendWork?: boolean | string;
  canArrive6am: boolean | string;
  hasAgriExperience: boolean | string;
  experienceText?: string;
  canStandHours: boolean | string;
  healthNote?: string;
  futureJobsInterest: boolean | string;
  interests?: string[];
  familyMore?: string;
  weightedScore: number;
  status: "pending_review" | "accepted" | "waitlist" | "rejected" | "withdrawn";
  followUpStatus: "not_contacted" | "called" | "no_answer" | "confirmed" | "declined" | "needs_follow_up";
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceJob = {
  id: string;
  title_ar: string;
  employer_id: string;
  status: "draft" | "active" | "paused" | "closed" | "filled";
  location_city?: string;
  job_type: string;
  applications_count: number;
  published_at: string;
  employer?: { company_name?: string } | null;
};

export type MarketplaceApplication = {
  id: string;
  job_id: string;
  veteran_name: string;
  phone: string;
  email?: string;
  status: "pending" | "reviewing" | "shortlisted" | "interview" | "rejected" | "accepted" | "withdrawn";
  applied_at: string;
  job?: { title_ar?: string } | null;
};

export async function listRecruitmentAnnouncements(): Promise<RecruitmentAnnouncement[]> {
  const response = await adminFetch("/api/admin/recruitment/announcements");
  const data = await response.json() as { announcements?: RecruitmentAnnouncement[] };
  return data.announcements ?? [];
}

export async function saveRecruitmentAnnouncement(
  payload: Partial<RecruitmentAnnouncement>,
  id?: string,
): Promise<RecruitmentAnnouncement> {
  const response = await adminFetch(
    id ? `/api/admin/recruitment/announcements/${id}` : "/api/admin/recruitment/announcements",
    {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(payload),
    },
  );
  const data = await response.json() as { announcement: RecruitmentAnnouncement };
  return data.announcement;
}

export async function deleteRecruitmentAnnouncement(id: string): Promise<void> {
  await adminFetch(`/api/admin/recruitment/announcements/${id}`, { method: "DELETE" });
}

export async function listSeasonalApplications(): Promise<SeasonalApplication[]> {
  const response = await adminFetch("/api/admin/koudama/surveys/seasonal-apple-job/applications");
  const data = await response.json() as { applications?: SeasonalApplication[] };
  return data.applications ?? [];
}

export async function updateSeasonalApplication(
  id: string,
  payload: Partial<Pick<SeasonalApplication, "status" | "followUpStatus" | "adminNotes">>,
): Promise<SeasonalApplication> {
  const response = await adminFetch(`/api/admin/koudama/surveys/seasonal-apple-job/applications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  const data = await response.json() as { application: SeasonalApplication };
  return data.application;
}

export async function listMarketplaceJobs(): Promise<MarketplaceJob[]> {
  const response = await adminFetch("/api/v2/jobs/admin/jobs");
  const data = await response.json() as { jobs?: MarketplaceJob[] };
  return data.jobs ?? [];
}

export async function listMarketplaceApplications(): Promise<MarketplaceApplication[]> {
  const response = await adminFetch("/api/v2/jobs/admin/applications");
  const data = await response.json() as { applications?: MarketplaceApplication[] };
  return data.applications ?? [];
}

export async function updateMarketplaceJobStatus(id: string, status: MarketplaceJob["status"]): Promise<MarketplaceJob> {
  const response = await adminFetch(`/api/v2/jobs/admin/jobs/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  const data = await response.json() as { job: MarketplaceJob };
  return data.job;
}

export async function updateMarketplaceApplicationStatus(id: string, status: MarketplaceApplication["status"]): Promise<MarketplaceApplication> {
  const response = await adminFetch(`/api/v2/jobs/admin/applications/${id}`, { method: "PATCH", body: JSON.stringify({ status }) });
  const data = await response.json() as { application: MarketplaceApplication };
  return data.application;
}

type AdminApiErrorKind = "network" | "http";

type RefreshResponse = {
  accessToken?: string;
};

export class AdminApiError extends Error {
  status?: number;
  kind: AdminApiErrorKind;
  details?: unknown;

  constructor(message: string, options: { kind: AdminApiErrorKind; status?: number; details?: unknown }) {
    super(message);
    this.name = "AdminApiError";
    this.kind = options.kind;
    this.status = options.status;
    this.details = options.details;
  }
}

function clearAdminTokens(): void {
  localStorage.removeItem("admin_token");
  localStorage.removeItem("admin_refresh_token");
}

function getCsrfToken(): string | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookies = document.cookie ? document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${CSRF_COOKIE_KEY}=`)) {
      return decodeURIComponent(cookie.slice(CSRF_COOKIE_KEY.length + 1));
    }
  }

  return null;
}

function isMutationMethod(method: string): boolean {
  return method !== "GET" && method !== "HEAD" && method !== "OPTIONS";
}

function buildAdminHeaders(init?: RequestInit, csrfToken?: string | null): Headers {
  const token = localStorage.getItem("admin_token") || "";
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }

  if (csrfToken && isMutationMethod(method)) {
    headers.set("x-csrf-token", csrfToken);
  }

  return headers;
}

async function readJsonSafe(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function refreshAdminAccessToken(): Promise<boolean> {
  const csrfToken = getCsrfToken();
  const headers = new Headers({ "Content-Type": "application/json" });
  if (csrfToken) {
    headers.set("x-csrf-token", csrfToken);
  }

  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}/api/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
    });
  } catch {
    return false;
  }

  const data = (await readJsonSafe(response)) as RefreshResponse | null;
  if (!response.ok || !data?.accessToken) {
    clearAdminTokens();
    return false;
  }

  localStorage.setItem("admin_token", data.accessToken);
  return true;
}

export function getAdminErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof AdminApiError)) {
    return fallback;
  }

  if (error.kind === "network") {
    return "تعذر الوصول إلى الخادم. تأكد من تشغيل gateway على المنفذ 8015 أو حدّد خادماً مخصّصاً.";
  }

  if (error.status === 401) {
    return "انتهت جلسة الإدارة أو لم يتم تسجيل الدخول. سجّل الدخول مرة أخرى.";
  }

  if (error.status === 403) {
    return "ليست لديك صلاحية كافية لتنفيذ هذا الإجراء. يتطلب ذلك دور superadmin.";
  }

  if (typeof error.message === "string" && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export function getAdminErrorCode(error: unknown): string | null {
  if (!(error instanceof AdminApiError) || !error.details || typeof error.details !== "object") return null;
  const code = (error.details as { error?: unknown }).error;
  return typeof code === "string" ? code : null;
}

export function getAdminCanonicalEditor(error: unknown): string | null {
  if (!(error instanceof AdminApiError) || !error.details || typeof error.details !== "object") return null;
  const owner = (error.details as { canonicalEditor?: unknown }).canonicalEditor;
  return typeof owner === "string" ? owner : null;
}

/** Wrapper around fetch that injects the admin auth header. */
export async function adminFetch(
  path: string,
  init?: RequestInit,
  allowRefresh = true,
): Promise<Response> {
  const csrfToken = getCsrfToken();
  const headers = buildAdminHeaders(init, csrfToken);

  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}${path}`, { ...init, headers, credentials: "include" });
  } catch {
    throw new AdminApiError("Cannot reach admin API", { kind: "network" });
  }

  if (res.status === 401 && allowRefresh) {
    const refreshed = await refreshAdminAccessToken();
    if (refreshed) {
      return adminFetch(path, init, false);
    }
  }

  if (!res.ok) {
    const data = await readJsonSafe(res);
    const message = typeof data?.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new AdminApiError(message, { kind: "http", status: res.status, details: data });
  }

  return res;
}

export async function logoutAdmin(): Promise<void> {
  try {
    await fetch(`${getApiUrl()}/api/auth/logout`, {
      method: "POST",
      headers: buildAdminHeaders({ method: "POST" }, getCsrfToken()),
      credentials: "include",
    });
  } catch {
    // Ignore logout network failures and clear local auth state anyway.
  }

  clearAdminTokens();
}

export async function getFeatureFlags(): Promise<FeatureFlagsResponse> {
  const res = await adminFetch("/api/admin/features");
  const data = await res.json();
  return {
    flags: data.flags ?? {},
    lastUpdatedAt: data.lastUpdatedAt ?? null,
  };
}

export async function saveFeatureFlags(flags: Record<string, boolean>): Promise<FeatureFlagsResponse> {
  const res = await adminFetch("/api/admin/features", {
    method: "PUT",
    body: JSON.stringify(flags),
  });
  const data = await res.json();
  return {
    flags: data.flags ?? flags,
    lastUpdatedAt: data.lastUpdatedAt ?? null,
  };
}

export type CmsStatus = "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "UNPUBLISHED" | "ARCHIVED";
export type CmsItem = { id: string; title: string; status: CmsStatus; version: string; updatedAt: string | null; record: Record<string, unknown> };
export type CmsListResponse = { items: CmsItem[]; total: number; page: number; pageSize: number; statusCounts: Record<CmsStatus, number> };
export type CmsDocumentKind = "image" | "pdf" | "doc" | "file";
export type CmsDocumentStorageStatus = "pending" | "verified" | "rejected";
export type CmsDocumentRecord = {
  id: string;
  userId: string | null;
  name: string;
  kind: CmsDocumentKind;
  status: CmsDocumentStorageStatus;
  tags: string[];
  filePath: string | null;
  updatedAt: string;
};
export type CmsDocumentItem = CmsItem & {
  status: Extract<CmsStatus, "DRAFT" | "PUBLISHED" | "ARCHIVED">;
  document: CmsDocumentRecord;
};
export type CmsDocumentListResponse = Omit<CmsListResponse, "items" | "statusCounts"> & {
  items: CmsDocumentItem[];
  statusCounts: Partial<Record<CmsStatus, number>>;
};
export type CmsDocumentDetailResponse = {
  ok: boolean;
  item: CmsDocumentItem;
  preview: { supported: boolean; url?: string; reason?: string };
  attachments: { supported: false; reason: string };
};
export type CmsDocumentWrite = {
  name: string;
  kind: CmsDocumentKind;
  status?: CmsDocumentStorageStatus;
  tags: string[];
  file_path?: string | null;
};
export type ManagedCmsDomain = "forms" | "announcements";
export type CmsRelationship = {
  entityId: string;
  publicId: string;
  domain: string;
  relationType: string;
  targetDomain: string;
  targetPublicId: string;
  createdAt: string;
};
export type CmsEntityVersion = {
  id: string;
  entityType: string;
  entityId: string;
  version: number;
  snapshot: unknown;
  createdBy: string;
  createdAt: string;
  reason?: string;
};
export type CmsAuditEvent = {
  id: string;
  eventType: string;
  actorId: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
  reason?: string;
  requestId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: string;
  immutableHash?: string;
};
export type CmsGenericItem = CmsItem & {
  domain: ManagedCmsDomain;
  publicId: string;
  publicCode: string | null;
  sourceId: string | null;
  createdAt: string;
  publishedAt: string | null;
  archivedAt: string | null;
  payload: Record<string, unknown>;
  sourceMeta: Record<string, unknown>;
  relationships?: CmsRelationship[];
};
export type CmsGenericListResponse = Omit<CmsListResponse, "items"> & {
  ok?: boolean;
  domain?: ManagedCmsDomain;
  items: CmsGenericItem[];
};
export type CmsGenericDetailResponse = { ok: boolean; item: CmsGenericItem };
export type CmsGenericWrite = {
  publicId: string;
  title: string;
  publicCode?: string | null;
  sourceId?: string | null;
  locale?: string | null;
  status?: CmsStatus;
  payload?: Record<string, unknown>;
  sourceMeta?: Record<string, unknown>;
};
export type CmsGenericPatch = Partial<Omit<CmsGenericWrite, "publicId">>;
export type CmsGenericRelationshipTarget = { targetDomain: string; targetPublicId: string };
export type CmsGenericVersionsResponse = { ok: boolean; versions: CmsEntityVersion[] };
export type CmsGenericAuditResponse = { ok: boolean; events: CmsAuditEvent[] };
export type CmsGenericRelationshipsResponse = { ok: boolean; relationships: CmsRelationship[] };
export type PayloadSyncCounts = {
  proceduresFetched: number;
  proceduresPublished: number;
  documentsFetched: number;
  documentsPublished: number;
  mappings: number;
};
export type PayloadSyncRun = {
  state: "RUNNING" | "COMPLETED" | "FAILED";
  runId: string;
  startedAt: string;
  finishedAt?: string;
  counts?: PayloadSyncCounts;
  contentHash?: string;
  errorCode?: string;
};
export type PayloadSyncStatus = {
  state: "NOT_CONFIGURED" | "UNREACHABLE" | "AUTH_FAILED" | "SCHEMA_INVALID" | "READY" | "SYNC_FAILED" | "ACTIVE" | "OUT_OF_SYNC";
  configured: boolean;
  running: boolean;
  lastRun: PayloadSyncRun | null;
  active: { runId: string; activatedAt: string; counts: PayloadSyncCounts; contentHash: string } | null;
};
export type PayloadSyncStatusResponse = {
  ok: boolean;
  source: "PAYLOAD";
  state: PayloadSyncStatus["state"];
  configured: boolean;
  running: boolean;
  lastRun: PayloadSyncRun | null;
  active: PayloadSyncStatus["active"];
};
export type PayloadEditorialDocumentItem = CmsItem & {
  status: "PUBLISHED";
  canonicalEditor: "PAYLOAD";
  document: Record<string, unknown>;
};
export type PayloadEditorialDocumentListResponse = {
  ok: boolean;
  source: "PAYLOAD";
  canonicalEditor: "PAYLOAD";
  available: boolean;
  items: PayloadEditorialDocumentItem[];
  total: number;
  page: number;
  pageSize: number;
  sync: PayloadSyncStatus;
};

export async function getCmsAnnouncements(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const queryString = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
  const res = await adminFetch(`/api/admin/cms/announcements${queryString ? "?" + queryString : ""}`);
  return (await res.json()) as CmsListResponse;
}

type CmsAction = "publish" | "unpublish" | "archive";
type CmsGenericAction = CmsAction | "restore";

export async function runCmsAnnouncementAction(id: string, action: CmsAction): Promise<CmsItem> {
  const res = await adminFetch(`/api/admin/cms/announcements/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  return ((await res.json()) as { item: CmsItem }).item;
}

export async function runCmsAnnouncementBulkArchive(ids: readonly string[]): Promise<CmsItem[]> {
  const res = await adminFetch("/api/admin/cms/announcements/bulk-actions/archive", { method: "POST", body: JSON.stringify({ ids }) });
  const data = await res.json() as { items: CmsItem[] };
  return data.items;
}

export async function runCmsAnnouncementBulkEdit(ids: readonly string[], patch: { title?: string; payload?: Record<string, unknown>; sourceMeta?: Record<string, unknown> }): Promise<CmsItem[]> {
  const res = await adminFetch("/api/admin/cms/announcements/bulk-actions/edit", { method: "POST", body: JSON.stringify({ ids, patch }) });
  const data = await res.json() as { items: CmsItem[] };
  return data.items;
}

export function getCmsFormPublicUrl(form: CmsGenericItem): string {
  const sourceId = form.sourceId?.trim();
  if (!sourceId) return "/forms";
  return `/forms/${encodeURIComponent(sourceId)}`;
}

export async function getCmsForms(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const queryString = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
  const res = await adminFetch(`/api/admin/cms/forms${queryString ? "?" + queryString : ""}`);
  return (await res.json()) as CmsListResponse;
}
export async function runCmsFormAction(id: string, action: CmsAction): Promise<CmsGenericItem> {
  const res = await adminFetch(`/api/admin/cms/forms/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  return ((await res.json()) as { item: CmsGenericItem }).item;
}

export async function getCmsProcedures(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
  const queryString = query.toString();
  const res = await adminFetch(`/api/admin/cms/procedures${queryString ? "?" + queryString : ""}`);
  return res.json();
}

export async function exportCmsProcedures(params: { q?: string; status?: CmsStatus } = {}): Promise<unknown> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.status) query.set("status", params.status);
  const suffix = query.toString() ? `?${query.toString()}` : "";
  const res = await adminFetch(`/api/admin/cms/procedures/export${suffix}`);
  return res.json();
}

export async function previewCmsProceduresExport(): Promise<string> {
  const res = await adminFetch("/api/admin/cms/procedures/export?format=html");
  return res.text();
}

export async function getCmsProcedure(id: string): Promise<CmsItem> {
  const res = await adminFetch(`/api/admin/cms/procedures/${encodeURIComponent(id)}`);
  return ((await res.json()) as { item: CmsItem }).item;
}

export async function getCmsProcedureVersions(id: string): Promise<CmsEntityVersion[]> {
  const res = await adminFetch(`/api/admin/cms/procedures/${encodeURIComponent(id)}/versions`);
  return ((await res.json()) as { versions: CmsEntityVersion[] }).versions;
}

export async function getCmsProcedureAudit(id: string): Promise<CmsAuditEvent[]> {
  const res = await adminFetch(`/api/admin/cms/procedures/${encodeURIComponent(id)}/audit`);
  return ((await res.json()) as { events: CmsAuditEvent[] }).events;
}

export type ProcedureImportSummary = {
  valid_count: number | null;
  warning_count: number | null;
  invalid_count: number | null;
  new_count: number | null;
  update_count: number | null;
  conflict_count: number | null;
  requested_count?: number | null;
  validated_count?: number | null;
  success_count?: number | null;
  failed_count?: number | null;
  skipped_count?: number | null;
  errors?: string[];
};

type ProcedureImportResponse = {
  state?: string;
  plan?: { planId?: string };
  validation?: { validRows?: number; invalidRows?: number; localizationDefects?: string[]; duplicateIds?: string[] };
  validRows?: number;
  invalidRows?: number;
  newRows?: number;
  updatedRows?: number;
  duplicateIds?: string[];
  result?: { requested_count?: number; validated_count?: number; success_count?: number; failed_count?: number; skipped_count?: number; errors?: Array<{ id?: string; reason?: string }> };
};

function asCount(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function importResultSummary(data: ProcedureImportResponse): ProcedureImportSummary {
  const validation = data.validation || {};
  const result = data.result;
  return {
    valid_count: asCount(data.validRows ?? validation.validRows),
    warning_count: Array.isArray(validation.localizationDefects) ? validation.localizationDefects.length : null,
    invalid_count: asCount(data.invalidRows ?? validation.invalidRows),
    new_count: asCount(data.newRows),
    update_count: asCount(data.updatedRows),
    conflict_count: Array.isArray(data.duplicateIds ?? validation.duplicateIds) ? (data.duplicateIds ?? validation.duplicateIds)?.length || 0 : null,
    requested_count: asCount(result?.requested_count),
    validated_count: asCount(result?.validated_count),
    success_count: asCount(result?.success_count),
    failed_count: asCount(result?.failed_count),
    skipped_count: asCount(result?.skipped_count),
    errors: Array.isArray(result?.errors) ? result.errors.map((entry) => `${entry.id || "unknown"}: ${entry.reason || "unknown failure"}`) : [],
  };
}

export async function dryRunCmsProceduresImport(payload: unknown): Promise<{ planId: string; summary: ProcedureImportSummary }> {
  try {
    const res = await adminFetch("/api/admin/cms/procedures/import/dry-run", { method: "POST", body: JSON.stringify(payload) });
    const data = await res.json() as ProcedureImportResponse;
    return { planId: String(data.plan?.planId || ""), summary: importResultSummary(data) };
  } catch (reason: unknown) {
    if (reason instanceof AdminApiError && reason.details && typeof reason.details === "object" && "validation" in reason.details) {
      const data = reason.details as ProcedureImportResponse;
      return { planId: "", summary: importResultSummary(data) };
    }
    throw reason;
  }
}

export async function applyCmsProceduresImport(planId: string): Promise<{ state: string; summary: ProcedureImportSummary }> {
  try {
    const res = await adminFetch("/api/admin/cms/procedures/import/apply", { method: "POST", body: JSON.stringify({ planId }) });
    const data = await res.json() as ProcedureImportResponse;
    return { state: String(data.state || "APPLIED"), summary: importResultSummary(data) };
  } catch (reason: unknown) {
    if (reason instanceof AdminApiError && reason.details && typeof reason.details === "object" && "result" in reason.details) {
      const data = reason.details as ProcedureImportResponse;
      return { state: String(data.state || "RECOVERY_REQUIRED"), summary: importResultSummary(data) };
    }
    throw reason;
  }
}

export async function publishCmsProceduresImport(planId: string): Promise<{ state: string; summary: ProcedureImportSummary }> {
  try {
    const res = await adminFetch("/api/admin/cms/procedures/import/publish", { method: "POST", body: JSON.stringify({ planId }) });
    const data = await res.json() as ProcedureImportResponse;
    return { state: String(data.state || "PUBLISHED"), summary: importResultSummary(data) };
  } catch (reason: unknown) {
    if (reason instanceof AdminApiError && reason.details && typeof reason.details === "object" && "result" in reason.details) {
      const data = reason.details as ProcedureImportResponse;
      return { state: String(data.state || "PUBLISH_RECOVERY_REQUIRED"), summary: importResultSummary(data) };
    }
    throw reason;
  }
}

export async function getPayloadSyncStatus(): Promise<PayloadSyncStatusResponse> {
  const res = await adminFetch("/api/admin/cms/payload-sync/status");
  return (await res.json()) as PayloadSyncStatusResponse;
}

export async function triggerPayloadSync(): Promise<PayloadSyncStatus["active"]> {
  const res = await adminFetch("/api/admin/cms/payload-sync/sync", { method: "POST" });
  const data = await res.json() as { activatedAt: string; runId: string; counts: PayloadSyncCounts; contentHash: string };
  return {
    runId: data.runId,
    activatedAt: data.activatedAt,
    counts: data.counts,
    contentHash: data.contentHash,
  };
}

type CmsGenericListParams = { q?: string; status?: CmsStatus; page?: number; pageSize?: number };

function cmsGenericPath(domain: ManagedCmsDomain, id?: string): string {
  const suffix = id === undefined ? "" : `/${encodeURIComponent(id)}`;
  return `/api/admin/cms/${domain}${suffix}`;
}

function cmsGenericQuery(params: CmsGenericListParams): string {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  const value = query.toString();
  return value ? `?${value}` : "";
}

export async function getCmsGenericEntities(domain: ManagedCmsDomain, params: CmsGenericListParams = {}): Promise<CmsGenericListResponse> {
  const res = await adminFetch(`${cmsGenericPath(domain)}${cmsGenericQuery(params)}`);
  return (await res.json()) as CmsGenericListResponse;
}

export async function getCmsGenericEntity(domain: ManagedCmsDomain, id: string): Promise<CmsGenericItem> {
  const res = await adminFetch(cmsGenericPath(domain, id));
  return ((await res.json()) as CmsGenericDetailResponse).item;
}

export async function createCmsGenericEntity(domain: ManagedCmsDomain, payload: CmsGenericWrite): Promise<CmsGenericItem> {
  const res = await adminFetch(cmsGenericPath(domain), { method: "POST", body: JSON.stringify(payload) });
  return ((await res.json()) as CmsGenericDetailResponse).item;
}

export async function updateCmsGenericEntity(domain: ManagedCmsDomain, id: string, payload: CmsGenericPatch): Promise<CmsGenericItem> {
  const res = await adminFetch(cmsGenericPath(domain, id), { method: "PATCH", body: JSON.stringify(payload) });
  return ((await res.json()) as CmsGenericDetailResponse).item;
}

export async function runCmsGenericAction(domain: ManagedCmsDomain, id: string, action: CmsGenericAction): Promise<CmsGenericItem> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/actions/${action}`, { method: "POST" });
  return ((await res.json()) as CmsGenericDetailResponse).item;
}

export async function runCmsGenericBulkArchive(domain: ManagedCmsDomain, ids: readonly string[]): Promise<CmsGenericItem[]> {
  const res = await adminFetch(`${cmsGenericPath(domain)}/bulk-actions/archive`, { method: "POST", body: JSON.stringify({ ids }) });
  return ((await res.json()) as { items: CmsGenericItem[] }).items;
}

export async function runCmsGenericBulkEdit(domain: ManagedCmsDomain, ids: readonly string[], patch: CmsGenericPatch): Promise<CmsGenericItem[]> {
  const res = await adminFetch(`${cmsGenericPath(domain)}/bulk-actions/edit`, { method: "POST", body: JSON.stringify({ ids, patch }) });
  return ((await res.json()) as { items: CmsGenericItem[] }).items;
}

export async function getCmsGenericVersions(domain: ManagedCmsDomain, id: string): Promise<CmsEntityVersion[]> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/versions`);
  return ((await res.json()) as CmsGenericVersionsResponse).versions;
}

export async function getCmsGenericAudit(domain: ManagedCmsDomain, id: string): Promise<CmsAuditEvent[]> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/audit`);
  return ((await res.json()) as CmsGenericAuditResponse).events;
}

export async function rollbackCmsGenericEntity(domain: ManagedCmsDomain, id: string, versionId: string): Promise<CmsGenericItem> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/rollback/${encodeURIComponent(versionId)}`, { method: "POST" });
  return ((await res.json()) as CmsGenericDetailResponse).item;
}

export async function getCmsGenericRelationships(domain: ManagedCmsDomain, id: string, relationType?: string): Promise<CmsRelationship[]> {
  const query = relationType ? `?relationType=${encodeURIComponent(relationType)}` : "";
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/relationships${query}`);
  return ((await res.json()) as CmsGenericRelationshipsResponse).relationships;
}

export async function addCmsGenericRelationship(domain: ManagedCmsDomain, id: string, relationship: { relationType: string; targetDomain: string; targetPublicId: string }): Promise<CmsRelationship> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/relationships`, { method: "POST", body: JSON.stringify(relationship) });
  return ((await res.json()) as { relationship: CmsRelationship }).relationship;
}

export async function replaceCmsGenericRelationships(domain: ManagedCmsDomain, id: string, relationType: string, targets: readonly CmsGenericRelationshipTarget[]): Promise<CmsRelationship[]> {
  const res = await adminFetch(`${cmsGenericPath(domain, id)}/relationships/${encodeURIComponent(relationType)}`, { method: "PUT", body: JSON.stringify({ targets }) });
  return ((await res.json()) as CmsGenericRelationshipsResponse).relationships;
}

export async function deleteCmsGenericRelationship(domain: ManagedCmsDomain, id: string, relationship: Pick<CmsRelationship, "relationType" | "targetDomain" | "targetPublicId">): Promise<void> {
  const path = `${cmsGenericPath(domain, id)}/relationships/${encodeURIComponent(relationship.relationType)}/${encodeURIComponent(relationship.targetDomain)}/${encodeURIComponent(relationship.targetPublicId)}`;
  await adminFetch(path, { method: "DELETE" });
}

export async function getCmsEditorialDocuments(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<PayloadEditorialDocumentListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
  const queryString = query.toString();
  const res = await adminFetch(`/api/admin/cms/editorial-documents${queryString ? "?" + queryString : ""}`);
  return (await res.json()) as PayloadEditorialDocumentListResponse;
}

export async function getCmsDocuments(params: { q?: string; status?: CmsStatus; kind?: CmsDocumentKind; tag?: string; page?: number; pageSize?: number } = {}): Promise<CmsDocumentListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
  const queryString = query.toString();
  const res = await adminFetch(`/api/admin/cms/documents${queryString ? "?" + queryString : ""}`);
  return res.json();
}

export async function getCmsDocument(id: string): Promise<CmsDocumentDetailResponse> {
  const res = await adminFetch(`/api/admin/cms/documents/${encodeURIComponent(id)}`);
  return res.json();
}

export async function createCmsDocument(payload: CmsDocumentWrite): Promise<CmsDocumentItem> {
  const res = await adminFetch("/api/admin/cms/documents", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return ((await res.json()) as { item: CmsDocumentItem }).item;
}

export async function updateCmsDocument(id: string, payload: Partial<CmsDocumentWrite>): Promise<CmsDocumentItem> {
  const res = await adminFetch(`/api/admin/cms/documents/${encodeURIComponent(id)}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
  return ((await res.json()) as { item: CmsDocumentItem }).item;
}

export async function getCmsDocumentPreview(id: string): Promise<CmsDocumentDetailResponse["preview"]> {
  const res = await adminFetch(`/api/admin/cms/documents/${encodeURIComponent(id)}/preview`);
  return ((await res.json()) as { preview: CmsDocumentDetailResponse["preview"] }).preview;
}

export async function runCmsDocumentAction(id: string, action: "publish" | "unpublish" | "archive"): Promise<CmsDocumentItem> {
  const res = await adminFetch(`/api/admin/cms/documents/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  const data = await res.json();
  return data.item;
}

export async function getWebUserSettings(): Promise<WebUserSettingsResponse> {
  const res = await adminFetch("/api/admin/web-user/settings");
  const data = await res.json();
  return {
    settings: data.settings,
    lastUpdatedAt: data.lastUpdatedAt ?? null,
  };
}

export async function saveWebUserSettings(settings: import("@watany/shared/web-user-settings").PublishedWebUserSettings): Promise<WebUserSettingsResponse> {
  const res = await adminFetch("/api/admin/web-user/settings", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  return {
    settings: data.settings,
    lastUpdatedAt: data.lastUpdatedAt ?? null,
  };
}
