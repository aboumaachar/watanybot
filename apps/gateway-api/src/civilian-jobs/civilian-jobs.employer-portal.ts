export type EmployerPortalStatus = "pending_review" | "approved" | "suspended";

export interface CivilianJobsEmployerPortalProfile {
  id: string;
  organizationName: string;
  contactName: string;
  contactPhone?: string;
  status: EmployerPortalStatus;
  approvedBy?: string;
}

export function canEmployerPublishOpportunity(profile: CivilianJobsEmployerPortalProfile): boolean {
  return profile.status === "approved";
}