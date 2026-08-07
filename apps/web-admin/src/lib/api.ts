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

export type WebUserSettingsResponse = {
  settings: import("@watany/shared/web-user-settings").PublishedWebUserSettings;
  lastUpdatedAt: string | null;
};

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
