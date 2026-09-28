import type { FastifyRequest, FastifyServerOptions } from "fastify";

export type RequestNetworkContext = {
  clientIp: string;
  peerIp: string;
  forwardedChain: string[];
};

export function normalizeIp(value: string | undefined | null): string {
  const ip = (value || "").trim();
  return ip.startsWith("::ffff:") ? ip.slice("::ffff:".length) : ip;
}

export function getRequestNetworkContext(request: FastifyRequest): RequestNetworkContext {
  const peerIp = normalizeIp(request.raw.socket.remoteAddress);
  const forwardedChain = Array.isArray(request.ips)
    ? request.ips.map((value) => normalizeIp(value)).filter(Boolean)
    : [];
  const clientIp = normalizeIp(request.ip) || peerIp;
  return { clientIp, peerIp, forwardedChain };
}

export function getTrustProxySetting(raw = process.env.TRUST_PROXY): FastifyServerOptions["trustProxy"] {
  const value = raw?.trim();
  if (!value || /^(true|1|on)$/iu.test(value)) return ["127.0.0.1", "::1"];
  if (/^(false|0|off)$/iu.test(value)) return false;
  const proxies = value.split(",").map((item) => item.trim()).filter(Boolean);
  return proxies.length > 0 ? proxies : false;
}
