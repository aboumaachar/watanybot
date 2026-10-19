const CSRF_COOKIE_KEY = "watany_csrf";

function browserLocation(): Location | null {
  return typeof globalThis.location === "undefined" ? null : globalThis.location;
}

export function getV19AdminApiBase(): string {
  const location = browserLocation();
  const hostname = location?.hostname.toLowerCase() || "";
  if (hostname === "koudama.com" || hostname.endsWith(".koudama.com")) {
    return `${location?.origin || "https://koudama.com"}/mcp`;
  }
  return "http://127.0.0.1:8099";
}

function getCsrfToken(): string | null {
  if (typeof globalThis.document === "undefined") return null;
  const cookies = globalThis.document.cookie ? globalThis.document.cookie.split("; ") : [];
  for (const cookie of cookies) {
    if (cookie.startsWith(`${CSRF_COOKIE_KEY}=`)) {
      return decodeURIComponent(cookie.slice(CSRF_COOKIE_KEY.length + 1));
    }
  }
  return null;
}

function clearAdminTokens(): void {
  globalThis.localStorage?.removeItem("admin_token");
  globalThis.localStorage?.removeItem("admin_refresh_token");
}
function buildHeaders(init?: RequestInit): Headers {
  const headers = new Headers(init?.headers);
  const token = globalThis.localStorage?.getItem("admin_token") || "";
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (!headers.has("Content-Type") && init?.body) headers.set("Content-Type", "application/json");
  return headers;
}

async function refreshAdminAccessToken(): Promise<boolean> {
  const headers = new Headers({ "Content-Type": "application/json" });
  const csrf = getCsrfToken();
  if (csrf) headers.set("x-csrf-token", csrf);
  let response: Response;
  try {
    response = await fetch(`${getV19AdminApiBase()}/api/auth/refresh`, {
      method: "POST",
      headers,
      credentials: "include",
    });
  } catch {
    return false;
  }
  const payload = await response.json().catch(() => null) as { accessToken?: string } | null;
  if (!response.ok || !payload?.accessToken) {
    clearAdminTokens();
    return false;
  }
  globalThis.localStorage?.setItem("admin_token", payload.accessToken);
  return true;
}
export class V19AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "V19AdminApiError";
    this.status = status;
  }
}

export async function v19AdminFetch(path: string, init?: RequestInit, allowRefresh = true): Promise<Response> {
  const response = await fetch(`${getV19AdminApiBase()}${path}`, {
    ...init,
    headers: buildHeaders(init),
    credentials: "include",
  });
  if (response.status === 401 && allowRefresh && await refreshAdminAccessToken()) {
    return v19AdminFetch(path, init, false);
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: string } | null;
    throw new V19AdminApiError(payload?.error || `HTTP ${response.status}`, response.status);
  }
  return response;
}

export async function downloadV19AdminExport(format: "csv" | "json"): Promise<void> {
  const response = await v19AdminFetch(`/api/veterans-2019/applications/export.${format}`);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `veterans-2019-applications.${format}`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
