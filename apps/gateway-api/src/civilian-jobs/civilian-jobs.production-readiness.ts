export interface CivilianJobsReleaseGate {
  id: string;
  description: string;
  required: boolean;
}

export const civilianJobsReleaseGates: CivilianJobsReleaseGate[] = [
  { id: "independence-regression", description: "Civilian Jobs remains independent from recruitment announcements", required: true },
  { id: "typecheck", description: "Full workspace typecheck passes", required: true },
  { id: "lint", description: "Full workspace lint passes", required: true },
  { id: "civilian-jobs-tests", description: "Civilian jobs focused tests pass", required: true },
  { id: "admin-review", description: "Admin import and opportunity review flow verified", required: true },
];