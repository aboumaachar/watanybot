import { TAXI_ADMIN_APPROVAL_GATES_PRESENT } from "./taxi-admin-approval-gates";
import { TAXI_PRISMA_PERSISTENCE_GATE_PRESENT } from "./taxi-prisma-persistence";

export const TAXI_PERSISTENCE_ADMIN_READINESS_GATES_PRESENT = true;

export type TaxiPersistenceReadinessInput = {
  prismaSchemaHasTaxiModels: boolean;
  prismaClientGenerated: boolean;
  repositoryUsesPrisma: boolean;
  adminApprovalGateEnforced: boolean;
  otpGateEnforced: boolean;
  auditEventsPersisted: boolean;
  documentReviewPersisted: boolean;
  encryptedPlateStorage: boolean;
};

export function evaluateTaxiPersistenceReadiness(input: TaxiPersistenceReadinessInput) {
  const failed: string[] = [];
  if (!input.prismaSchemaHasTaxiModels) failed.push("PRISMA_TAXI_MODELS_MISSING");
  if (!input.prismaClientGenerated) failed.push("PRISMA_CLIENT_NOT_REGENERATED");
  if (!input.repositoryUsesPrisma) failed.push("REPOSITORY_NOT_DB_BACKED");
  if (!input.adminApprovalGateEnforced) failed.push("ADMIN_APPROVAL_GATE_NOT_ENFORCED");
  if (!input.otpGateEnforced) failed.push("OTP_GATE_NOT_ENFORCED");
  if (!input.auditEventsPersisted) failed.push("AUDIT_EVENTS_NOT_PERSISTED");
  if (!input.documentReviewPersisted) failed.push("DOCUMENT_REVIEW_NOT_PERSISTED");
  if (!input.encryptedPlateStorage) failed.push("ENCRYPTED_PLATE_STORAGE_NOT_CONFIRMED");
  return {
    ready: failed.length === 0,
    failed,
    markers: {
      TAXI_ADMIN_APPROVAL_GATES_PRESENT,
      TAXI_PRISMA_PERSISTENCE_GATE_PRESENT,
    },
  };
}