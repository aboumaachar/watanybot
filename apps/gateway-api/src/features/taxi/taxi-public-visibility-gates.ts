// TAXI_PUBLIC_VISIBILITY_GATES_PRESENT
// Public visibility rules for Taxi Trusted Mobility.

export type TaxiDriverVisibilityInput = {
  approvalStatus?: string | null;
  otpVerifiedAt?: string | Date | null;
  suspendedAt?: string | Date | null;
  publicVisible?: boolean | null;
  documentReviewStatus?: string | null;
};

export function isTaxiDriverPubliclyVisible(driver: TaxiDriverVisibilityInput): boolean {
  if (!driver) return false;
  if (driver.approvalStatus !== "APPROVED") return false;
  if (!driver.otpVerifiedAt) return false;
  if (driver.suspendedAt) return false;
  if (driver.publicVisible !== true) return false;
  if (driver.documentReviewStatus && driver.documentReviewStatus !== "APPROVED") return false;
  return true;
}

export function maskTaxiPlate(plate: string | null | undefined): string {
  if (!plate) return "***";
  const clean = plate.replace(/\s+/g, "").toUpperCase();
  if (clean.length <= 3) return "***";
  return `${clean.slice(0, 2)}***${clean.slice(-1)}`;
}