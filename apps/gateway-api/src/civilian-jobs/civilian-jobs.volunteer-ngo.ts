export type VolunteerRegistrationStatus = "registered" | "confirmed" | "attended" | "absent" | "completed" | "certificate_issued";

export interface CivilianJobsVolunteerOpportunityProfile {
  opportunityId: string;
  ngoPartnerId?: string;
  requiredSkills: string[];
  registrationStatus?: VolunteerRegistrationStatus;
}

export function isVolunteerCompleted(status: VolunteerRegistrationStatus): boolean {
  return status === "completed" || status === "certificate_issued";
}