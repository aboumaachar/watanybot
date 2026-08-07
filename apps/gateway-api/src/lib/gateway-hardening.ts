export type CorsOriginPolicyOptions = {
  allowlist: ReadonlySet<string>;
  isDevelopment: boolean;
};

function isValidLocalPort(value: string): boolean {
  const port = Number(value);
  return Number.isInteger(port) && port >= 1 && port <= 65535;
}

function isPrivateIpv4Host(hostname: string): boolean {
  if (/^10\./.test(hostname) || /^192\.168\./.test(hostname)) {
    return true;
  }

  const match = hostname.match(/^172\.(\d{1,3})\./);
  if (!match) {
    return false;
  }

  const secondOctet = Number(match[1]);
  return Number.isInteger(secondOctet) && secondOctet >= 16 && secondOctet <= 31;
}

export function isLoopbackDevOrigin(origin: string): boolean {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const isHttpOrigin = parsed.protocol === "http:" || parsed.protocol === "https:";
    return isHttpOrigin
      && (hostname === "localhost" || hostname === "127.0.0.1" || isPrivateIpv4Host(hostname))
      && isValidLocalPort(parsed.port);
  } catch {
    return false;
  }
}

export function isCorsOriginAllowed(
  origin: string | undefined,
  options: CorsOriginPolicyOptions,
): boolean {
  if (!origin) {
    return true;
  }

  return options.allowlist.has(origin)
    || (options.isDevelopment && isLoopbackDevOrigin(origin));
}

export function getGatewayErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code || "")
    : "";
}

export function isIgnorableGatewayDisconnectError(error: unknown): boolean {
  const errorCode = getGatewayErrorCode(error);
  return errorCode === "ECONNABORTED" || errorCode === "EPIPE" || errorCode === "ECONNRESET";
}