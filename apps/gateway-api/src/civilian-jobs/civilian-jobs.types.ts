export type OpportunityType =
  | "PAID_JOB"
  | "PART_TIME_JOB"
  | "CONTRACT_JOB"
  | "FREELANCE_SERVICE"
  | "VOLUNTEER_WORK"
  | "INTERNSHIP"
  | "TRAINING"
  | "FAMILY_MEMBER_OPPORTUNITY";

export type OpportunityAudience = "VETERAN" | "SPOUSE" | "CHILD" | "FAMILY_MEMBER" | "PUBLIC";

export type OpportunityStatus = "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "ARCHIVED";

export type OpportunityApplicationStatus =
  | "NEW_APPLICATION"
  | "PROFILE_INCOMPLETE"
  | "REVIEWED"
  | "MATCHED"
  | "SENT_TO_EMPLOYER"
  | "INTERVIEW_REQUESTED"
  | "ACCEPTED"
  | "REJECTED"
  | "FOLLOW_UP_NEEDED"
  | "CLOSED";

export interface CivilianOpportunity {
  id: string;
  type: OpportunityType;
  audience: OpportunityAudience[];
  title: string;
  organization: string;
  location: string;
  category: string;
  summary: string;
  description: string;
  requirements: string[];
  applicationMethod: string;
  sourceName?: string;
  sourceUrl?: string;
  deadline?: string;
  status: OpportunityStatus;
  adminVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunityApplicationInput {
  opportunityId: string;
  applicantName: string;
  applicantPhone: string;
  applicantType: OpportunityAudience;
  note?: string;
  cvUrl?: string;
}

export interface OpportunityApplicationRecord extends OpportunityApplicationInput {
  id: string;
  status: OpportunityApplicationStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OpportunitySource {
  id: string;
  name: string;
  url: string;
  sourceType: "JOB_BOARD" | "NGO" | "UN_AGENCY" | "UNIVERSITY" | "EMPLOYER" | "GOVERNMENT" | "MANUAL";
  crawlPolicy: "MANUAL_ONLY" | "RSS_OR_API_FIRST" | "PUBLIC_ALLOWED_REVIEW_REQUIRED";
  enabled: boolean;
  notes: string;
}