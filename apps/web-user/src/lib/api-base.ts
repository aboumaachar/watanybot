const DEFAULT_GATEWAY_PORT = "8010";
const LEGACY_GATEWAY_PORT = "4000";
const ALT_GATEWAY_PORT = "4001";
const API_BASE_STORAGE_KEY = "watany_api_base_url";
const API_BASE_FORCE_STORAGE_KEY = "watany_api_base_force";
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "0.0.0.0", "::1", "[::1]"]);

function isLoopbackHost(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function getBrowserGatewayOrigin(port = DEFAULT_GATEWAY_PORT): string {
  if (globalThis.location === undefined) {
    return `http://127.0.0.1:${port}`;
  }

  return `${globalThis.location.protocol}//${globalThis.location.hostname}:${port}`;
}

function getStaticDefaultApiBaseUrl(port = DEFAULT_GATEWAY_PORT): string {
  return getConfiguredApiBaseUrl(port) || getBrowserGatewayOrigin(port);
}

function getDevProxyApiBaseUrl(): string | null {
  if (globalThis.location === undefined || !import.meta.env.DEV) {
    return null;
  }

  // Use same-origin as the page so Vite dev server proxy intercepts /api/* calls
  // and forwards them to the actual gateway (configured via VITE_API_URL / VITE_DEV_PROXY_TARGET).
  return `${globalThis.location.protocol}//${globalThis.location.host}`;
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function joinBasePath(basePath: string, path: string): string {
  const normalizedBase = basePath === "/" ? "" : trimTrailingSlash(basePath);
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}

function normalizeWebSocketUrl(value: string, port = DEFAULT_GATEWAY_PORT): string {
  const resolved = globalThis.location === undefined
    ? new URL(value)
    : new URL(value, globalThis.location.origin);

  const currentHost = globalThis.location === undefined ? resolved.hostname : globalThis.location.hostname;
  if (LOOPBACK_HOSTS.has(resolved.hostname) && !LOOPBACK_HOSTS.has(currentHost)) {
    resolved.protocol = globalThis.location.protocol;
    resolved.hostname = currentHost;
    resolved.port = resolved.port || port;
  }

  if (resolved.protocol === "http:") {
    resolved.protocol = "ws:";
  } else if (resolved.protocol === "https:") {
    resolved.protocol = "wss:";
  }

  return trimTrailingSlash(resolved.toString());
}

function getConfiguredWebSocketBaseUrl(port = DEFAULT_GATEWAY_PORT): string | null {
  const rawUrl = (import.meta.env.VITE_WS_URL as string | undefined)?.trim();
  if (!rawUrl) {
    return null;
  }

  return normalizeWebSocketUrl(rawUrl, port);
}

function getConfiguredApiBaseUrl(port = DEFAULT_GATEWAY_PORT): string | null {
  const rawUrl = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  if (!rawUrl) {
    return null;
  }

  if (globalThis.location === undefined) {
    return trimTrailingSlash(rawUrl);
  }

  const resolved = new URL(rawUrl, globalThis.location.origin);
  const currentHost = globalThis.location.hostname;
  if (!LOOPBACK_HOSTS.has(resolved.hostname) || LOOPBACK_HOSTS.has(currentHost)) {
    return trimTrailingSlash(resolved.toString());
  }

  resolved.protocol = globalThis.location.protocol;
  resolved.hostname = currentHost;
  resolved.port = resolved.port || port;
  return trimTrailingSlash(resolved.toString());
}

function getStoredApiBaseUrl(): string | null {
  if (globalThis.localStorage === undefined) {
    return null;
  }

  const stored = globalThis.localStorage.getItem(API_BASE_STORAGE_KEY)?.trim();
  return stored ? trimTrailingSlash(stored) : null;
}

function getPreferredWebSocketApiBaseUrl(port = DEFAULT_GATEWAY_PORT): string {
  const candidates = uniqueApiBases([
    getForcedApiBaseUrl(),
    getConfiguredApiBaseUrl(port),
    getStoredApiBaseUrl(),
    getStaticDefaultApiBaseUrl(port),
  ]);

  return candidates.find((candidate) => !isSameOriginDevProxyBase(candidate)) || getStaticDefaultApiBaseUrl(port);
}

function getForcedApiBaseUrl(): string | null {
  if (globalThis.localStorage === undefined) {
    return null;
  }

  const stored = globalThis.localStorage.getItem(API_BASE_FORCE_STORAGE_KEY)?.trim();
  return stored ? trimTrailingSlash(stored) : null;
}

function uniqueApiBases(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    if (!value) continue;
    const normalized = trimTrailingSlash(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

function isLoopbackApiBase(value: string): boolean {
  try {
    const resolved = globalThis.location === undefined
      ? new URL(value)
      : new URL(value, globalThis.location.origin);
    return isLoopbackHost(resolved.hostname);
  } catch {
    return false;
  }
}

function splitCandidateApiBase(value: string | null): { loopback: string | null; remote: string | null } {
  if (!value || globalThis.location === undefined) {
    return { loopback: null, remote: value };
  }

  try {
    const resolved = new URL(value, globalThis.location.origin);
    const normalized = trimTrailingSlash(resolved.toString());
    if (isLoopbackHost(resolved.hostname)) {
      return { loopback: normalized, remote: null };
    }

    return { loopback: null, remote: normalized };
  } catch {
    return { loopback: null, remote: value };
  }
}

function getLoopbackGatewayPorts(defaultPort = DEFAULT_GATEWAY_PORT): string[] {
  return Array.from(new Set([LEGACY_GATEWAY_PORT, ALT_GATEWAY_PORT, defaultPort]));
}

export function getDefaultApiBaseUrl(port = DEFAULT_GATEWAY_PORT): string {
  return getCandidateApiBaseUrls(port)[0] || getStaticDefaultApiBaseUrl(port);
}

export function isSameOriginDevProxyBase(baseUrl: string | null | undefined): boolean {
  if (!import.meta.env.DEV || globalThis.location === undefined || !baseUrl) {
    return false;
  }

  try {
    const resolved = new URL(baseUrl, globalThis.location.origin);
    return trimTrailingSlash(resolved.toString()) === trimTrailingSlash(globalThis.location.origin);
  } catch {
    return false;
  }
}

export function getCandidateApiBaseUrls(port = DEFAULT_GATEWAY_PORT): string[] {
  const forced = getForcedApiBaseUrl();
  const configured = getConfiguredApiBaseUrl(port);
  const stored = getStoredApiBaseUrl();
  const devProxyBase = getDevProxyApiBaseUrl();

  if (globalThis.location === undefined) {
    return uniqueApiBases([forced, configured, stored, getStaticDefaultApiBaseUrl(port)]);
  }

  const currentHost = globalThis.location.hostname;
  const loopbackCandidates = isLoopbackHost(currentHost)
    ? getLoopbackGatewayPorts(port).map((candidatePort) => getBrowserGatewayOrigin(candidatePort))
    : [];

  const { loopback: forcedLoopback, remote: forcedRemote } = splitCandidateApiBase(forced);
  const { loopback: storedLoopback, remote: storedRemote } = splitCandidateApiBase(stored);

  if (devProxyBase) {
    // In local dev, use same-origin /api through Vite proxy to avoid hardcoded-port probes.
    const configuredRemote = configured && !isLoopbackApiBase(configured) ? configured : null;

    return uniqueApiBases([
      forcedRemote,
      devProxyBase,
      forcedLoopback,
      ...loopbackCandidates,
      configuredRemote,
      storedRemote,
    ]);
  }

  return uniqueApiBases([
    forcedRemote ?? forcedLoopback,
    configured,
    ...loopbackCandidates,
    storedLoopback,
    storedRemote,
    getStaticDefaultApiBaseUrl(port),
  ]);
}

export function getDefaultApiWebSocketUrl(path: string, port = DEFAULT_GATEWAY_PORT): string | null {
  const configuredBase = getConfiguredWebSocketBaseUrl(port);
  if (configuredBase) {
    const url = new URL(configuredBase);
    url.pathname = joinBasePath(url.pathname || "/", path);
    url.search = "";
    url.hash = "";
    return url.toString();
  }

  const apiBaseUrl = getDefaultApiBaseUrl(port);
  const resolvedApiBaseUrl = isSameOriginDevProxyBase(apiBaseUrl)
    ? getPreferredWebSocketApiBaseUrl(port)
    : apiBaseUrl;

  const url = new URL(resolvedApiBaseUrl);
  if (!isLoopbackHost(url.hostname) && url.pathname && url.pathname !== "/") {
    return null;
  }

  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = path.startsWith("/") ? path : `/${path}`;
  url.search = "";
  url.hash = "";
  return url.toString();
}