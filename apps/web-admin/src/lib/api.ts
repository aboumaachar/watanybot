/** Static fallback (used by legacy imports). Live code should call getApiUrl() instead. */
export const API = import.meta.env.VITE_API_URL || "http://localhost:8010";

/** Returns the currently active admin API base URL (respects runtime server switch). */
export function getApiUrl(): string {
  return localStorage.getItem("admin_api_url") || API;
}

export const SERVERS = [
  { label: "Local", url: "http://localhost:8010" },
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

async function refreshAdminAccessToken(): Promise<boolean> {
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
    return "تعذر الوصول إلى الخادم. تأكد من تشغيل gateway على المنفذ 8010 أو حدّد خادماً مخصّصاً.";
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
export type CmsFormItem = CmsItem & { publicId: string; publicCode: string | null; sourceId: string | null };

export async function getCmsAnnouncements(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const queryString = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
  const res = await adminFetch(`/api/admin/cms/announcements${queryString ? "?" + queryString : ""}`);
  return (await res.json()) as CmsListResponse;
}

export async function runCmsAnnouncementAction(id: string, action: "publish" | "unpublish" | "archive"): Promise<CmsItem> {
  const res = await adminFetch(`/api/admin/cms/announcements/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  return ((await res.json()) as { item: CmsItem }).item;
}

export function getCmsFormPublicUrl(form: CmsFormItem): string {
  const sourceId = form.sourceId?.trim();
  if (!sourceId) return "/forms";
  return `/forms/${encodeURIComponent(sourceId)}`;
}

export async function getCmsForms(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const queryString = new URLSearchParams(Object.entries(params).filter(([, value]) => value) as string[][]).toString();
  const res = await adminFetch(`/api/admin/cms/forms${queryString ? "?" + queryString : ""}`);
  return (await res.json()) as CmsListResponse;
}
export async function runCmsFormAction(id: string, action: "publish" | "unpublish" | "archive"): Promise<CmsFormItem> {
  const res = await adminFetch(`/api/admin/cms/forms/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  return ((await res.json()) as { item: CmsFormItem }).item;
}

export async function getCmsProcedures(params: { q?: string; status?: CmsStatus; page?: number; pageSize?: number } = {}): Promise<CmsListResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => { if (value) query.set(key, String(value)); });
  const queryString = query.toString();
  const res = await adminFetch(`/api/admin/cms/procedures${queryString ? "?" + queryString : ""}`);
  return res.json();
}

export async function runCmsProcedureAction(id: string, action: "publish" | "unpublish" | "archive" | "restore"): Promise<CmsItem> {
  const res = await adminFetch(`/api/admin/cms/procedures/${encodeURIComponent(id)}/actions/${action}`, { method: "POST" });
  const data = await res.json();
  return data.item;
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
