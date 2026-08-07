export const TAXI_ADMIN_APPROVAL_GATES_PRESENT = true;

export type TaxiDriverApprovalLike = {
  status?: string | null;
  phoneVerifiedAt?: string | Date | null;
  documentsApprovedAt?: string | Date | null;
  suspendedAt?: string | Date | null;
  plateNumberEncrypted?: string | null;
  platePublicLastDigits?: string | null;
};

export function isTaxiDriverPubliclyVisible(driver: TaxiDriverApprovalLike): boolean {
  return driver.status === "APPROVED" &&
    Boolean(driver.phoneVerifiedAt) &&
    Boolean(driver.documentsApprovedAt) &&
    !driver.suspendedAt;
}

export function getTaxiDriverVisibilityBlockers(driver: TaxiDriverApprovalLike): string[] {
  const blockers: string[] = [];
  if (driver.status !== "APPROVED") blockers.push("DRIVER_NOT_ADMIN_APPROVED");
  if (!driver.phoneVerifiedAt) blockers.push("PHONE_NOT_OTP_VERIFIED");
  if (!driver.documentsApprovedAt) blockers.push("DOCUMENTS_NOT_APPROVED");
  if (driver.suspendedAt) blockers.push("DRIVER_SUSPENDED");
  return blockers;
}

export function maskTaxiPlate(plateNumber: string | null | undefined): string {
  const cleaned = String(plateNumber || "").replace(/\s+/g, "");
  if (cleaned.length <= 3) return "***";
  return `***${cleaned.slice(-3)}`;
}

export function toPublicTaxiDriverView<T extends TaxiDriverApprovalLike & Record<string, unknown>>(driver: T): Record<string, unknown> {
  const publicView: Record<string, unknown> = { ...driver };
  delete publicView.plateNumberEncrypted;
  publicView.platePublicLastDigits = driver.platePublicLastDigits || maskTaxiPlate(driver.plateNumberEncrypted);
  publicView.visibilityBlockers = getTaxiDriverVisibilityBlockers(driver);
  publicView.publiclyVisible = isTaxiDriverPubliclyVisible(driver);
  return publicView;
}