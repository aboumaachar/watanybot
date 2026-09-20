/**
 * Future gateway-issued assertion contract for the external Payload boundary.
 * This is deliberately type-only: no exchange endpoint or Payload consumer is
 * implemented until the external editor is ready for the contract.
 */
export type PayloadGatewayAssertion = {
  issuer: "watany-gateway";
  subject: string;
  audience: "watany-payload";
  issuedAt: number;
  expiresAt: number;
  jwtId: string;
  role: string;
  capabilities: readonly string[];
};

export function isPayloadGatewayAssertion(value: unknown): value is PayloadGatewayAssertion {
  if (!value || typeof value !== "object") return false;
  const assertion = value as Partial<PayloadGatewayAssertion>;
  return assertion.issuer === "watany-gateway"
    && typeof assertion.subject === "string"
    && assertion.subject.length > 0
    && assertion.audience === "watany-payload"
    && typeof assertion.issuedAt === "number"
    && typeof assertion.expiresAt === "number"
    && Number.isInteger(assertion.issuedAt)
    && Number.isInteger(assertion.expiresAt)
    && Number.isFinite(assertion.issuedAt)
    && Number.isFinite(assertion.expiresAt)
    && assertion.expiresAt > assertion.issuedAt
    && typeof assertion.jwtId === "string"
    && assertion.jwtId.length > 0
    && typeof assertion.role === "string"
    && assertion.role.length > 0
    && Array.isArray(assertion.capabilities)
    && assertion.capabilities.every((capability) => typeof capability === "string");
}