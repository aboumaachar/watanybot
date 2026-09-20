import { jwtVerify } from "jose";
import type { AuthStrategy } from "payload";
import { PAYLOAD_CMS_SESSION_COOKIE, verifyPayloadCmsSession } from "./payloadCmsSession";

const issuer = "watany-gateway";
const audience = "watany-payload";

type Claims = {
  issuer: string;
  subject: string;
  audience: string;
  jwtId: string;
  role: string;
  capabilities: string[];
  sub: string;
  email?: string;
  displayName?: string;
};

function secretKey(): Uint8Array | null {
  const secret = process.env.PAYLOAD_SSO_SECRET?.trim();
  return secret ? new TextEncoder().encode(secret) : null;
}

function serviceSubject(): string {
  return process.env.PAYLOAD_SERVICE_SUBJECT?.trim() || "";
}

function configuredServiceToken(): string {
  return process.env.PAYLOAD_CMS_API_TOKEN?.trim() || "";
}

function serviceUser() {
  const subject = serviceSubject();
  return {
    id: subject,
    collection: "gateway-admins" as const,
    gatewayUserId: subject,
    email: `${subject}@gateway.invalid`,
    roleSnapshot: "superadmin",
    capabilitySnapshot: ["cms.read", "cms.create", "cms.edit"],
  };
}

export const gatewaySsoStrategy: AuthStrategy = {
  name: "gateway-sso",
  async authenticate({ headers, payload }) {
    const authorization = headers.get("authorization");
    const key = secretKey();
    const cookieHeader = headers.get("cookie") || "";
    const cmsToken = cookieHeader.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${PAYLOAD_CMS_SESSION_COOKIE}=`))?.slice(PAYLOAD_CMS_SESSION_COOKIE.length + 1);

    if (!authorization?.startsWith("Bearer ") && cmsToken) {
      const session = await verifyPayloadCmsSession(cmsToken);
      if (!session) return { user: null };
      const result = await payload.find({ collection: "gateway-admins", where: { id: { equals: session.projectionId } }, limit: 1, depth: 0 });
      const user = result.docs[0];
      return user && String(user.gatewayUserId) === session.sub ? { user: { ...user, collection: "gateway-admins" } } : { user: null };
    }

    if (!authorization?.startsWith("Bearer ") || !key) return { user: null };

    if (configuredServiceToken() && authorization.slice(7) === configuredServiceToken() && serviceSubject()) {
      return { user: serviceUser() };
    }

    try {
      const { payload: claims } = await jwtVerify<Claims>(authorization.slice(7), key, { issuer, audience });
      if (claims.issuer !== issuer || claims.audience !== audience || !claims.subject || claims.sub !== claims.subject
        || !claims.jwtId || !claims.role || !Array.isArray(claims.capabilities)
        || claims.capabilities.some((capability: unknown) => typeof capability !== "string")) {
        return { user: null };
      }

      if (claims.subject === serviceSubject()) {
        return {
          user: { ...serviceUser(), email: `${claims.subject}@gateway.invalid`, displayName: claims.displayName, roleSnapshot: claims.role, capabilitySnapshot: claims.capabilities },
        };
      }

      const result = await payload.find({
        collection: "gateway-admins",
        where: { gatewayUserId: { equals: claims.subject } },
        limit: 1,
        depth: 0,
      });
      const existing = result.docs[0];
      const data = {
        gatewayUserId: claims.subject,
        email: claims.email || `${claims.subject}@gateway.invalid`,
        displayName: claims.displayName,
        roleSnapshot: claims.role,
        capabilitySnapshot: claims.capabilities,
        lastAuthenticatedAt: new Date().toISOString(),
      };
      const user = existing
        ? await payload.update({ collection: "gateway-admins", id: existing.id, data, overrideAccess: true })
        : await payload.create({ collection: "gateway-admins", data, overrideAccess: true });
      return { user: { ...user, collection: "gateway-admins" } };
    } catch {
      return { user: null };
    }
  },
};
