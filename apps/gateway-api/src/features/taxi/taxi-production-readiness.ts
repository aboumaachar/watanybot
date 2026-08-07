import { TAXI_AUDIT_LOG_MARKER } from "./taxi-production-audit";
import { TAXI_DOCUMENT_REVIEW_MARKER } from "./taxi-production-document-review";
import { TAXI_OTP_POLICY_MARKER } from "./taxi-production-otp";
import { TAXI_PRODUCTION_SECURITY_MARKER } from "./taxi-production-security";

export type TaxiProductionGate = {
  id: string;
  label: string;
  requiredForPublicLaunch: boolean;
  status: "PENDING" | "PARTIAL" | "PASS";
};

export function getTaxiProductionHardeningGates(): TaxiProductionGate[] {
  return [
    { id: "db-persistence", label: "Taxi data stored in real database", requiredForPublicLaunch: true, status: "PENDING" },
    { id: "admin-approval", label: "Admin approval before public driver listing", requiredForPublicLaunch: true, status: "PARTIAL" },
    { id: "otp", label: TAXI_OTP_POLICY_MARKER, requiredForPublicLaunch: true, status: "PARTIAL" },
    { id: "audit", label: TAXI_AUDIT_LOG_MARKER, requiredForPublicLaunch: true, status: "PARTIAL" },
    { id: "encrypted-storage", label: TAXI_PRODUCTION_SECURITY_MARKER, requiredForPublicLaunch: true, status: "PARTIAL" },
    { id: "document-review", label: TAXI_DOCUMENT_REVIEW_MARKER, requiredForPublicLaunch: true, status: "PARTIAL" },
  ];
}

export function isTaxiProductionReady(): boolean {
  return getTaxiProductionHardeningGates().every((gate) => !gate.requiredForPublicLaunch || gate.status === "PASS");
}

export const TAXI_PRODUCTION_READINESS_MARKER = "TAXI_PRODUCTION_READINESS_GATES_PRESENT";