import { civilianOpportunitySeed, civilianOpportunitySources } from "./civilian-jobs.seed";
import type { CivilianOpportunity, OpportunityApplicationInput, OpportunityApplicationRecord, OpportunitySource, OpportunityType } from "./civilian-jobs.types";

const applications: OpportunityApplicationRecord[] = [];

function includesText(value: string | undefined, query: string): boolean {
  if (!query) return true;
  return (value || "").toLowerCase().includes(query.toLowerCase());
}

export interface ListOpportunityFilters {
  type?: OpportunityType;
  location?: string;
  category?: string;
  audience?: string;
  q?: string;
}

export function listCivilianOpportunities(filters: ListOpportunityFilters = {}): CivilianOpportunity[] {
  return civilianOpportunitySeed.filter((item) => {
    if (item.status !== "PUBLISHED") return false;
    if (filters.type && item.type !== filters.type) return false;
    if (filters.location && !includesText(item.location, filters.location)) return false;
    if (filters.category && !includesText(item.category, filters.category)) return false;
    if (filters.audience && !item.audience.includes(filters.audience as never)) return false;
    if (filters.q) {
      const haystack = [item.title, item.organization, item.location, item.category, item.summary, item.description].join(" ");
      if (!includesText(haystack, filters.q)) return false;
    }
    return true;
  });
}

export function getCivilianOpportunity(id: string): CivilianOpportunity | undefined {
  return civilianOpportunitySeed.find((item) => item.id === id && item.status === "PUBLISHED");
}

export function listCivilianOpportunitySources(): OpportunitySource[] {
  return civilianOpportunitySources;
}

export function createCivilianOpportunityApplication(input: OpportunityApplicationInput): OpportunityApplicationRecord {
  const opportunity = getCivilianOpportunity(input.opportunityId);
  if (!opportunity) {
    throw new Error("Civilian opportunity was not found or is not published.");
  }
  if (!input.applicantName || !input.applicantPhone || !input.applicantType) {
    throw new Error("Applicant name, phone, and applicant type are required.");
  }
  const now = new Date().toISOString();
  const record: OpportunityApplicationRecord = {
    ...input,
    id: `app-${Date.now()}`,
    status: "NEW_APPLICATION",
    createdAt: now,
    updatedAt: now
  };
  applications.push(record);
  return record;
}

export function listCivilianOpportunityApplications(): OpportunityApplicationRecord[] {
  return [...applications];
}