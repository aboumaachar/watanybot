export type CivilianJobsNotificationEvent =
  | "opportunity.published"
  | "application.created"
  | "application.status_changed"
  | "match.created"
  | "import.review_required"
  | "freelancer.contact_requested";

export interface CivilianJobsNotificationPayload {
  event: CivilianJobsNotificationEvent;
  recipientId?: string;
  opportunityId?: string;
  applicationId?: string;
  messageAr: string;
}

export function createCivilianJobsNotificationPayload(event: CivilianJobsNotificationEvent, messageAr: string): CivilianJobsNotificationPayload {
  return { event, messageAr };
}