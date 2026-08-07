export type TaxiAuditAction =
  | "DRIVER_APPLICATION_CREATED"
  | "DRIVER_APPROVED"
  | "DRIVER_REJECTED"
  | "DRIVER_SUSPENDED"
  | "DRIVER_AVAILABILITY_UPDATED"
  | "RESERVATION_REQUESTED"
  | "RESERVATION_ACCEPTED"
  | "RESERVATION_CANCELLED"
  | "DOCUMENT_SUBMITTED"
  | "DOCUMENT_REVIEWED"
  | "PHONE_OTP_REQUESTED"
  | "PHONE_OTP_VERIFIED";

export type TaxiAuditEventInput = {
  actorUserId?: string;
  entityType: "driver" | "vehicle" | "reservation" | "document" | "otp" | "settings";
  entityId?: string;
  action: TaxiAuditAction;
  metadata?: Record<string, unknown>;
};

export function buildTaxiAuditEvent(input: TaxiAuditEventInput): TaxiAuditEventInput & { createdAt: string } {
  return {
    ...input,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString(),
  };
}

export const TAXI_AUDIT_LOG_MARKER = "TAXI_AUDIT_LOG_SCAFFOLD_PRESENT";