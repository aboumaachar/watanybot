export const MIDDLE_EAST_SECURITY_CAMPAIGN_ID = "middle-east-security" as const;

export const MES_LOCATIONS = ["بيروت", "طرابلس", "عكار", "الجنوب", "البقاع"] as const;
export const MES_PROFICIENCY = ["لا أجيد", "وسط", "جيد"] as const;

export type MiddleEastSecurityStatus = "pending" | "approved" | "rejected";
export type MiddleEastSecurityFollowUpStatus =
  | "not_contacted"
  | "to_contact"
  | "contacted"
  | "confirmed"
  | "no_response"
  | "withdrawn";

export type MiddleEastSecurityInput = {
  full_name: string;
  birth_date: string;
  age_years?: number | string;
  birth_place: string;
  address?: string | null;
  phone: string;
  preferred_location: string;
  mohafaza?: string | null;
  mohafaza_id?: string | null;
  caza?: string | null;
  caza_id?: string | null;
  village?: string | null;
  village_id?: string | null;
  village_pcode?: string | null;
  location_dataset_version?: string | null;
  location_approval_status?: string | null;
  arabic_read: string;
  arabic_write: string;
  english_read: string;
  english_write: string;
  security_training: boolean | string;
  security_training_details?: string;
  ngo_experience: boolean | string;
  ngo_details?: string;
  notes?: string;
};

export type MiddleEastSecurityApplication = MiddleEastSecurityInput & {
  id: string;
  userId?: string;
  campaignId: typeof MIDDLE_EAST_SECURITY_CAMPAIGN_ID;
  status: MiddleEastSecurityStatus;
  followUpStatus: MiddleEastSecurityFollowUpStatus;
  adminNotes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type MiddleEastSecuritySubmissionContext = {
  userId?: string;
  trackingToken?: string;
  idempotencyKey?: string;
};

export type MiddleEastSecuritySubmissionResult = {
  item: MiddleEastSecurityApplication;
  trackingToken?: string;
  idempotent: boolean;
};

export type MiddleEastSecurityAdminPatch = {
  status?: MiddleEastSecurityStatus;
  followUpStatus?: MiddleEastSecurityFollowUpStatus;
  adminNotes?: string;
  expectedVersion?: number;
};

export type MiddleEastSecurityHistoryEntry = {
  version: number;
  eventType: "SUBMITTED" | "MANAGEMENT_UPDATED";
  snapshot: Pick<MiddleEastSecurityApplication, "status" | "followUpStatus" | "adminNotes" | "version" | "updatedAt">;
  actorId: string;
  createdAt: string;
};
