export type TaxiUserRole = "rider" | "driver" | "admin" | "superadmin";
export type TaxiDriverStatus = "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";

export type TaxiSecurityActor = {
  userId?: string;
  roles?: TaxiUserRole[];
  phoneVerified?: boolean;
};

export function hasTaxiAdminAccess(actor: TaxiSecurityActor | null | undefined): boolean {
  const roles = actor?.roles ?? [];
  return roles.includes("admin") || roles.includes("superadmin");
}

export function canPubliclyListTaxiDriver(status: TaxiDriverStatus, phoneVerified: boolean): boolean {
  return status === "APPROVED" && phoneVerified === true;
}

export function maskTaxiPlate(value: string | null | undefined): string {
  const raw = String(value ?? "").replace(/\s+/g, "");
  if (raw.length <= 2) return "**";
  return `***${raw.slice(-2)}`;
}

export function assertTaxiAdminAccess(actor: TaxiSecurityActor | null | undefined): void {
  if (!hasTaxiAdminAccess(actor)) {
    const error = new Error("TAXI_ADMIN_ACCESS_REQUIRED");
    error.name = "TaxiSecurityError";
    throw error;
  }
}

export const TAXI_PRODUCTION_SECURITY_MARKER = "TAXI_PRODUCTION_SECURITY_GATES_PRESENT";