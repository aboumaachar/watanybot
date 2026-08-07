export type ExternalIntegrationMode = "manual_import" | "approved_feed" | "safe_crawl";

export interface CivilianJobsExternalSourcePolicy {
  sourceId: string;
  mode: ExternalIntegrationMode;
  robotsReviewed: boolean;
  termsReviewed: boolean;
  adminReviewRequired: true;
}

export function canRunExternalImport(policy: CivilianJobsExternalSourcePolicy): boolean {
  return policy.adminReviewRequired === true && policy.robotsReviewed && policy.termsReviewed;
}