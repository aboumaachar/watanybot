import { jwtVerify, SignJWT } from "jose";

export const PAYLOAD_CMS_SESSION_AUDIENCE = "watanybot-payload-cms-session";
export const PAYLOAD_CMS_SESSION_PURPOSE = "payload-admin-session";
export const PAYLOAD_CMS_SESSION_TTL_SECONDS = 900;
export const PAYLOAD_CMS_SESSION_COOKIE = "watanybot_payload_cms_session";

type CmsSessionClaims = {
  sub: string;
  projectionId: string;
  gatewaySessionId?: string;
  purpose: typeof PAYLOAD_CMS_SESSION_PURPOSE;
};

function sessionKey(): Uint8Array | null {
  const secret = process.env.PAYLOAD_CMS_SESSION_SECRET?.trim();
  return secret ? new TextEncoder().encode(secret) : null;
}

export async function signPayloadCmsSession(input: Omit<CmsSessionClaims, "purpose">): Promise<string> {
  const key = sessionKey();
  if (!key) throw new Error("PAYLOAD_CMS_SESSION_SECRET environment variable is required");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...input, purpose: PAYLOAD_CMS_SESSION_PURPOSE })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + PAYLOAD_CMS_SESSION_TTL_SECONDS)
    .setAudience(PAYLOAD_CMS_SESSION_AUDIENCE)
    .setJti(crypto.randomUUID())
    .sign(key);
}

export async function verifyPayloadCmsSession(token: string): Promise<CmsSessionClaims | null> {
  const key = sessionKey();
  if (!key) return null;
  try {
    const { payload } = await jwtVerify<CmsSessionClaims>(token, key, {
      algorithms: ["HS256"],
      audience: PAYLOAD_CMS_SESSION_AUDIENCE,
    });
    return payload.sub && payload.projectionId && payload.purpose === PAYLOAD_CMS_SESSION_PURPOSE
      ? payload
      : null;
  } catch {
    return null;
  }
}