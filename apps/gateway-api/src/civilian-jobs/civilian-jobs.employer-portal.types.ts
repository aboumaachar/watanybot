export type EmployerPortalStatus = "PENDING_REVIEW" | "APPROVED" | "SUSPENDED" | "REJECTED";
export type EmployerOpportunityNeedStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "MATCHING" | "CLOSED" | "REJECTED";

export interface CivilianEmployerProfile {
  id: string;
  organizationName: string;
  contactName: string;
  phone?: string;
  email?: string;
  website?: string;
  sector?: string;
  locationLabel?: string;
  status: EmployerPortalStatus;
  veteranFriendly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CivilianEmployerOpportunityNeed {
  id: string;
  employerId: string;
  title: string;
  description: string;
  neededSkillIds: string[];
  locationLabel?: string;
  workMode: "FULL_TIME" | "PART_TIME" | "PROJECT" | "DAILY" | "REMOTE" | "VOLUNTEER";
  status: EmployerOpportunityNeedStatus;
  createdAt: string;
  updatedAt: string;
}

export interface EmployerCandidateMatch {
  employerNeedId: string;
  candidateId: string;
  candidateType: "VETERAN" | "FAMILY_MEMBER" | "FREELANCER" | "VOLUNTEER";
  score: number;
  reasons: string[];
}