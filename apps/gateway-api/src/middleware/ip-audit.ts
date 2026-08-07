import type { FastifyRequest } from "fastify";
import type { IpAuditRecord } from "../superadmin/superadmin-users.types";

export function getClientIpAddress(
  req: FastifyRequest
): { ipAddress: string; source: IpAuditRecord["source"] } {
  const forwardedFor = req.headers["x-forwarded-for"];
  if (typeof forwardedFor === "string" && forwardedFor.trim()) {
    return { ipAddress: forwardedFor.split(",")[0].trim(), source: "x-forwarded-for" };
  }

  const realIp = req.headers["x-real-ip"];
  if (typeof realIp === "string" && realIp.trim()) {
    return { ipAddress: realIp.trim(), source: "x-real-ip" };
  }

  if (req.ip) {
    return { ipAddress: req.ip, source: "req-ip" };
  }

  return { ipAddress: req.socket?.remoteAddress ?? "unknown", source: "socket" };
}

export function buildIpAuditRecord(req: FastifyRequest, userId?: string): IpAuditRecord {
  const client = getClientIpAddress(req);

  return {
    userId,
    ipAddress: client.ipAddress,
    source: client.source,
    userAgent:
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    route: req.url,
    method: req.method,
    capturedAt: new Date().toISOString(),
  };
}
