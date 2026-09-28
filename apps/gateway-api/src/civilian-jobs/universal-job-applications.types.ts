export type UniversalJobTemplateStatus = "draft" | "published" | "paused" | "archived";
export type UniversalJobApplicationStatus = "pending" | "reviewing" | "shortlisted" | "approved" | "rejected" | "hired" | "withdrawn";
export type UniversalJobFollowUpStatus = "not_contacted" | "to_contact" | "contacted" | "interview_scheduled" | "interview_completed" | "waiting_documents" | "follow_up_required" | "closed" | "no_response" | "withdrawn";
export type UniversalJobFieldType = "text" | "textarea" | "integer" | "phone" | "email" | "date" | "yes_no" | "select" | "multi_select" | "universal_locator";

export type UniversalJobFieldCondition = {
  field: string;
  equals?: string | number | boolean;
  includes?: string;
};

export type UniversalJobFieldDefinition = {
  key: string;
  labelAr: string;
  labelEn?: string;
  type: UniversalJobFieldType;
  required?: boolean;
  placeholder?: string;
  helpText?: string;
  min?: number;
  max?: number;
  options?: string[];
  condition?: UniversalJobFieldCondition;
  reusableFromProfile?: boolean;
  reusableFromPrevious?: boolean;
  adminList?: boolean;
  searchable?: boolean;
  filterable?: boolean;
};

export type UniversalJobTemplate = {
  id: string;
  slug: string;
  employerId?: string;
  employerName: string;
  ownerUserId?: string;
  jobId?: string;
  name: string;
  titleAr: string;
  introAr: string;
  employmentType: string;
  status: UniversalJobTemplateStatus;
  allowProfileAutofill: boolean;
  allowPreviousAutofill: boolean;
  allowBlankStart: boolean;
  currentVersion: number;
  draftFields: UniversalJobFieldDefinition[];
  draftSettings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type UniversalJobPublishedTemplate = UniversalJobTemplate & {
  fields: UniversalJobFieldDefinition[];
  settings: Record<string, unknown>;
};

export type UniversalJobAddressInput = {
  address?: string;
  mohafaza?: string;
  mohafaza_id?: string;
  caza?: string;
  caza_id?: string;
  village?: string;
  village_id?: string;
  village_pcode?: string;
  location_dataset_version?: string;
  location_approval_status?: string;
};

export type UniversalJobApplicationInput = {
  answers?: Record<string, unknown>;
  address?: UniversalJobAddressInput;
  prefillSource?: "profile" | "previous" | "blank";
  prefillSourceApplicationId?: string;
};

export type UniversalJobApplication = {
  id: string;
  reference: string;
  templateId: string;
  templateVersion: number;
  jobId?: string;
  employerId?: string;
  applicantUserId?: string;
  prefillSource: string;
  prefillSourceApplicationId?: string;
  applicantName: string;
  phone: string;
  ageYears?: number;
  address?: string;
  mohafaza?: string;
  mohafazaId?: string;
  caza?: string;
  cazaId?: string;
  village?: string;
  villageId?: string;
  villagePcode?: string;
  locationDatasetVersion?: string;
  locationApprovalStatus?: string;
  answers: Record<string, unknown>;
  status: UniversalJobApplicationStatus;
  followUpStatus: UniversalJobFollowUpStatus;
  adminNotes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type UniversalJobApplicationHistoryEntry = {
  version: number;
  eventType: "SUBMITTED" | "MANAGEMENT_UPDATED";
  snapshot: Record<string, unknown>;
  actorId: string;
  createdAt: string;
};

export type UniversalJobSubmissionContext = {
  userId?: string;
  trackingToken?: string;
  idempotencyKey?: string;
};

export type UniversalJobSubmissionResult = {
  item: UniversalJobApplication;
  trackingToken?: string;
  idempotent: boolean;
};

export type UniversalJobManagerContext = {
  userId: string;
  role: string;
};
