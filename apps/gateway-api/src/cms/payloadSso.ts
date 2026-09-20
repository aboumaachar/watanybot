import { randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import type { UserRole } from "@watany/types";
import type { PayloadGatewayAssertion } from "./payloadSsoContract";

export const PAYLOAD_SSO_ISSUER = "watany-gateway" as const;
export const PAYLOAD_SSO_AUDIENCE = "watany-payload" as const;
export const PAYLOAD_SSO_LIFETIME_SECONDS = 300;

type SsoClaims = PayloadGatewayAssertion & {
  iss: typeof PAYLOAD_SSO_ISSUER;
  sub: string;
  aud: typeof PAYLOAD_SSO_AUDIENCE;
  iat: number;
  exp: number;
  jti: string;
};

function getSsoSecret(): string {
  const secret = process.env.PAYLOAD_SSO_SECRET?.trim();
  if (!secret) throw new Error("PAYLOAD_SSO_SECRET environment variable is required");
  return secret;
}

export function mintPayloadSsoAssertion(input: {
  userId: string;
  role: UserRole;
  capabilities: readonly string[];
  nowSeconds?: number;
}): string {
  const issuedAt = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  const expiresAt = issuedAt + PAYLOAD_SSO_LIFETIME_SECONDS;
  const jwtId = randomUUID();
  const claims: SsoClaims = {
    issuer: PAYLOAD_SSO_ISSUER,
    subject: input.userId,
    audience: PAYLOAD_SSO_AUDIENCE,
    issuedAt,
    expiresAt,
    jwtId,
    role: input.role,
    capabilities: [...input.capabilities],
    iss: PAYLOAD_SSO_ISSUER,
    sub: input.userId,
    aud: PAYLOAD_SSO_AUDIENCE,
    iat: issuedAt,
    exp: expiresAt,
    jti: jwtId,
  };
  return jwt.sign(claims, getSsoSecret(), { algorithm: "HS256" });
}

export function verifyPayloadSsoAssertion(token: string, nowSeconds?: number): PayloadGatewayAssertion | null {
  try {
    const decoded = jwt.verify(token, getSsoSecret(), {
      algorithms: ["HS256"],
      issuer: PAYLOAD_SSO_ISSUER,
      audience: PAYLOAD_SSO_AUDIENCE,
      clockTimestamp: nowSeconds,
    }) as Partial<SsoClaims>;
    const assertion: PayloadGatewayAssertion = {
      issuer: decoded.issuer as PayloadGatewayAssertion["issuer"],
      subject: decoded.subject as string,
      audience: decoded.audience as PayloadGatewayAssertion["audience"],
      issuedAt: decoded.issuedAt as number,
      expiresAt: decoded.expiresAt as number,
      jwtId: decoded.jwtId as string,
      role: decoded.role as string,
      capabilities: decoded.capabilities as readonly string[],
    };
    return assertion.issuer === PAYLOAD_SSO_ISSUER
      && assertion.subject === decoded.sub
      && assertion.audience === PAYLOAD_SSO_AUDIENCE
      && assertion.issuedAt === decoded.iat
      && assertion.expiresAt === decoded.exp
      && assertion.jwtId === decoded.jti
      && assertion.expiresAt > (nowSeconds ?? Math.floor(Date.now() / 1000))
      && typeof assertion.role === "string"
      && Array.isArray(assertion.capabilities)
      && assertion.capabilities.every((capability) => typeof capability === "string")
      ? assertion
      : null;
  } catch {
    return null;
  }
}
