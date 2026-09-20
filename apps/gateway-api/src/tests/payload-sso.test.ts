import { beforeEach, describe, expect, it } from "vitest";
import jwt from "jsonwebtoken";
import {
  mintPayloadSsoAssertion,
  verifyPayloadSsoAssertion,
  PAYLOAD_SSO_LIFETIME_SECONDS,
} from "../cms/payloadSso";

beforeEach(() => {
  process.env.PAYLOAD_SSO_SECRET = "ud2-test-payload-sso-secret";
});

describe("Payload SSO assertion", () => {
  it("mints and verifies the frozen claims with a short lifetime", () => {
    const token = mintPayloadSsoAssertion({
      userId: "gateway-user-1",
      role: "superadmin",
      capabilities: ["cms.read", "cms.publish"],
      nowSeconds: 1_000,
    });

    const assertion = verifyPayloadSsoAssertion(token, 1_001);
    expect(assertion).toMatchObject({
      issuer: "watany-gateway",
      subject: "gateway-user-1",
      audience: "watany-payload",
      issuedAt: 1_000,
      expiresAt: 1_000 + PAYLOAD_SSO_LIFETIME_SECONDS,
      role: "superadmin",
      capabilities: ["cms.read", "cms.publish"],
    });
  });

  it.each([
    ["expired", { clockTimestamp: 1_301 }],
    ["wrong issuer", { issuer: "other-issuer" }],
    ["wrong audience", { audience: "other-audience" }],
  ])("rejects %s assertions", (_label, override) => {
    const token = jwt.sign({
      issuer: "watany-gateway",
      subject: "gateway-user-1",
      audience: "watany-payload",
      issuedAt: 1_000,
      expiresAt: 1_300,
      jwtId: "jti-1",
      role: "superadmin",
      capabilities: ["cms.read"],
      iss: "watany-gateway",
      sub: "gateway-user-1",
      aud: "watany-payload",
      iat: 1_000,
      exp: 1_300,
      jti: "jti-1",
      ...override,
    }, process.env.PAYLOAD_SSO_SECRET, { algorithm: "HS256" });
    expect(verifyPayloadSsoAssertion(token, "clockTimestamp" in override ? 1_301 : 1_001)).toBeNull();
  });

  it("rejects a tampered signature and missing subject", () => {
    const token = mintPayloadSsoAssertion({ userId: "gateway-user-1", role: "admin", capabilities: ["cms.read"], nowSeconds: 1_000 });
    expect(verifyPayloadSsoAssertion(`${token}tampered`, 1_001)).toBeNull();

    const missingSubject = jwt.sign({ issuer: "watany-gateway", audience: "watany-payload", iat: 1_000, exp: 1_300, jti: "jti-2", role: "admin", capabilities: [] }, process.env.PAYLOAD_SSO_SECRET, { algorithm: "HS256" });
    expect(verifyPayloadSsoAssertion(missingSubject, 1_001)).toBeNull();
  });
});
