export const AIN_MREISSEH_BUILDING_ASSISTANT_CAMPAIGN_ID = "ain-mreisseh-building-assistant" as const;

export type AinMreissehBuildingAssistantStatus = "pending" | "approved" | "rejected";
export type AinMreissehBuildingAssistantFollowUpStatus =
  | "not_contacted"
  | "to_contact"
  | "contacted"
  | "confirmed"
  | "no_response"
  | "withdrawn";

export interface AinMreissehBuildingAssistantApplicationInput {
  name: string;
  phone: string;
  age: number | string;
  email?: string;
  governorate: string;
  governorateAr?: string;
  caza: string;
  cazaAr?: string;
  village: string;
  villageAr?: string;
  villageId: string;
  canWorkFullTime: boolean | string;
  acceptsSalary600: boolean | string;
  wantsHousing: boolean | string;
  availableStartDate: string;
}

export interface AinMreissehBuildingAssistantApplication extends AinMreissehBuildingAssistantApplicationInput {
  id: string;
  campaignId: typeof AIN_MREISSEH_BUILDING_ASSISTANT_CAMPAIGN_ID;
  status: AinMreissehBuildingAssistantStatus;
  followUpStatus: AinMreissehBuildingAssistantFollowUpStatus;
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

export interface AinMreissehBuildingAssistantAdminPatch {
  status?: AinMreissehBuildingAssistantStatus;
  followUpStatus?: AinMreissehBuildingAssistantFollowUpStatus;
  adminNotes?: string;
  expectedUpdatedAt?: string;
}

export type AinMreissehBuildingAssistantManagementSnapshot = Pick<AinMreissehBuildingAssistantApplication, "status" | "followUpStatus" | "adminNotes" | "updatedAt">;

export type AinMreissehBuildingAssistantHistoryEntry = {
  version: number;
  eventType: "SUBMITTED" | "MANAGEMENT_UPDATED";
  snapshot: AinMreissehBuildingAssistantManagementSnapshot;
  actorId: string;
  createdAt: string;
};
