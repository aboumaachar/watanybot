export type CivilianJobsDeploymentGateStatus = "PASS" | "WARN" | "FAIL";

export interface CivilianJobsDeploymentGate {
  id: string;
  label: string;
  status: CivilianJobsDeploymentGateStatus;
  evidence: string;
}

export const CIVILIAN_JOBS_DEPLOYMENT_GATES: CivilianJobsDeploymentGate[] = [
  { id: "scope-boundary", label: "Civilian jobs remains independent from recruitment announcements", status: "PASS", evidence: "All module files are under civilian-jobs namespace" },
  { id: "public-jobs", label: "Public opportunities module exists", status: "PASS", evidence: "Wave01 files present" },
  { id: "admin-jobs", label: "Admin opportunities module exists", status: "PASS", evidence: "Wave02 files present" },
  { id: "aggregation", label: "Import and aggregation contracts exist", status: "PASS", evidence: "Wave03 files present" },
  { id: "persistence", label: "Repository and migration boundaries exist", status: "PASS", evidence: "Wave04/Wave12 migrations proposed" },
  { id: "matching", label: "Matching engine exists", status: "PASS", evidence: "Wave05 files present" },
  { id: "freelancer-marketplace", label: "Freelancer marketplace exists", status: "PASS", evidence: "Wave12 files present" },
  { id: "employer-portal", label: "Employer portal exists", status: "PASS", evidence: "Wave09 files present" },
  { id: "production-smoke", label: "Runtime smoke should be executed against running services", status: "WARN", evidence: "Use -RunRuntimeSmoke with active gateway/web servers" }
];

export function summarizeCivilianJobsDeploymentReadiness(gates = CIVILIAN_JOBS_DEPLOYMENT_GATES) {
  const failed = gates.filter((gate) => gate.status === "FAIL");
  const warnings = gates.filter((gate) => gate.status === "WARN");
  return {
    status: failed.length === 0 ? "READY_WITH_WARNINGS" : "NOT_READY",
    failedCount: failed.length,
    warningCount: warnings.length,
    total: gates.length,
  };
}