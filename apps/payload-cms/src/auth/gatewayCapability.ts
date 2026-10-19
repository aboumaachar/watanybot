export function hasGatewayCapability(
  user: unknown,
  capability: string,
): boolean {
  if (!user || typeof user !== "object") return false;

  const record = user as { capabilitySnapshot?: unknown };
  const capabilities = record.capabilitySnapshot;
  if (!Array.isArray(capabilities) || capabilities.some((value) => typeof value !== "string")) {
    return false;
  }

  return capabilities.includes("superadmin.all") || capabilities.includes(capability);
}