export interface CivilianJobsProductionHardeningCheck {
  id: string;
  title: string;
  required: boolean;
  status: "pending" | "pass" | "fail" | "deferred";
}

export const civilianJobsProductionHardeningChecks: CivilianJobsProductionHardeningCheck[] = [
  { id: "db-persistence", title: "Repository backed by durable database storage", required: true, status: "pending" },
  { id: "indexes", title: "Indexes exist for opportunity type, source, status, location, and skill search", required: true, status: "pending" },
  { id: "audit", title: "Admin publish/reject/import decisions are auditable", required: true, status: "pending" },
  { id: "backup", title: "Backup/restore plan documented for jobs tables", required: true, status: "pending" },
];