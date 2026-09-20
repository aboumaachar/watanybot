import { describe, expect, it } from "vitest";
import { isPayloadGatewayAssertion } from "../cms/payloadSsoContract";

describe("Payload gateway assertion contract", () => {
  it("accepts a complete future-boundary assertion", () => {
    expect(isPayloadGatewayAssertion({
      issuer: "watany-gateway",
      subject: "gateway-user-1",
      audience: "watany-payload",
      issuedAt: 1_000,
      expiresAt: 2_000,
      jwtId: "jti-1",
      role: "superadmin",
      capabilities: ["cms.read"],
    })).toBe(true);
  });

  it.each([
    { expiresAt: 1_000 },
    { subject: "" },
    { capabilities: ["cms.read", 42] },
    { jwtId: "" },
  ])("rejects an invalid assertion: $subject", (override) => {
    const assertion = {
      issuer: "watany-gateway",
      subject: "gateway-user-1",
      audience: "watany-payload",
      issuedAt: 1_000,
      expiresAt: 2_000,
      jwtId: "jti-1",
      role: "superadmin",
      capabilities: ["cms.read"],
      ...override,
    };

    expect(isPayloadGatewayAssertion(assertion)).toBe(false);
  });
});