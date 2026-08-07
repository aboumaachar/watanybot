export interface CivilianJobsAnalyticsSnapshot {
  publishedOpportunities: number;
  pendingImports: number;
  applications: number;
  matches: number;
  freelancerProfiles: number;
}

export function calculatePlacementRate(accepted: number, totalApplications: number): number {
  if (totalApplications <= 0) return 0;
  return Math.round((accepted / totalApplications) * 10000) / 100;
}