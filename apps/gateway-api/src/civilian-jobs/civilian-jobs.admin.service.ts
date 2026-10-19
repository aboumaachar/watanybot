import { updateCivilianOpportunityApplicationStatus } from "./civilian-jobs.service.js";
import type {
  CivilianOpportunity,
  OpportunityApplicationRecord,
  OpportunityApplicationStatus,
  OpportunitySource,
  OpportunityStatus,
  OpportunityType,
  OpportunityAudience,
} from "./civilian-jobs.types.js";
import { civilianJobsRepository } from "./civilian-jobs.repository.js";
import type { CivilianJobsRepository } from "./civilian-jobs.repository.js";

export { listCivilianOpportunityApplications, listCivilianOpportunitySources } from "./civilian-jobs.service.js";

function safeString(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => safeString(item)).filter(Boolean);
}

export interface AdminListFilters {
  status?: OpportunityStatus;
  q?: string;
}

export async function adminListOpportunities(
  filters: AdminListFilters = {},
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<CivilianOpportunity[]> {
  const items = await repository.listOpportunities();
  return items.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.q) {
      const hay = [item.title,item.organization,item.location,item.category,item.summary].join(" ").toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) return false;
    }
    return true;
  });
}

export async function adminGetOpportunity(
  id: string,
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<CivilianOpportunity | undefined> {
  return repository.getOpportunity(id);
}

export async function adminCreateOpportunity(
  body: Record<string, unknown>,
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<CivilianOpportunity> {
  if (!body.title || !body.organization || !body.location || !body.type) {
    throw new Error("title, organization, location, and type are required.");
  }
  const now = new Date().toISOString();
  const item: CivilianOpportunity = {
    id: `opp-admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type: (body.type as OpportunityType) || "PAID_JOB",
    audience: Array.isArray(body.audience) ? (body.audience as OpportunityAudience[]) : ["PUBLIC"],
    title: safeString(body.title), organization: safeString(body.organization), location: safeString(body.location),
    category: safeString(body.category), summary: safeString(body.summary), description: safeString(body.description),
    requirements: safeStringArray(body.requirements),
    applicationMethod: safeString(body.applicationMethod, "Apply via WatanyBot."),
    sourceName: safeString(body.sourceName, "Manual admin entry"),
    sourceUrl: safeString(body.sourceUrl, "internal://manual"),
    deadline: body.deadline ? safeString(body.deadline) : undefined,
    status: "DRAFT", adminVerified: false, createdAt: now, updatedAt: now,
  };
  return repository.saveOpportunity(item);
}

export async function adminUpdateOpportunity(
  id: string,
  body: Record<string, unknown>,
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<CivilianOpportunity | undefined> {
  const item = await repository.getOpportunity(id);
  if (!item) return undefined;
  const updated: CivilianOpportunity = {
    ...item,
    title: body.title === undefined ? item.title : safeString(body.title),
    organization: body.organization === undefined ? item.organization : safeString(body.organization),
    location: body.location === undefined ? item.location : safeString(body.location),
    category: body.category === undefined ? item.category : safeString(body.category),
    summary: body.summary === undefined ? item.summary : safeString(body.summary),
    description: body.description === undefined ? item.description : safeString(body.description),
    requirements: body.requirements === undefined ? item.requirements : safeStringArray(body.requirements),
    applicationMethod: body.applicationMethod === undefined ? item.applicationMethod : safeString(body.applicationMethod),
    sourceName: body.sourceName === undefined ? item.sourceName : safeString(body.sourceName),
    sourceUrl: body.sourceUrl === undefined ? item.sourceUrl : safeString(body.sourceUrl),
    deadline: body.deadline === undefined ? item.deadline : safeString(body.deadline) || undefined,
    audience: body.audience === undefined ? item.audience : safeStringArray(body.audience) as OpportunityAudience[],
    type: body.type === undefined ? item.type : body.type as OpportunityType,
    updatedAt: new Date().toISOString(),
  };
  return repository.saveOpportunity(updated);
}

export async function adminPublishOpportunity(id: string, repository: CivilianJobsRepository = civilianJobsRepository, actorId?: string) {
  return repository.updateOpportunityStatus(id, "PUBLISHED", actorId, "admin publish");
}

export async function adminArchiveOpportunity(id: string, repository: CivilianJobsRepository = civilianJobsRepository, actorId?: string) {
  return repository.updateOpportunityStatus(id, "ARCHIVED", actorId, "admin archive");
}

export async function adminRejectOpportunity(id: string, repository: CivilianJobsRepository = civilianJobsRepository, actorId?: string) {
  return repository.updateOpportunityStatus(id, "ARCHIVED", actorId, "admin reject");
}

const VALID_APPLICATION_STATUSES = new Set<OpportunityApplicationStatus>([
  "NEW_APPLICATION", "PROFILE_INCOMPLETE", "REVIEWED", "MATCHED",
  "SENT_TO_EMPLOYER", "INTERVIEW_REQUESTED", "ACCEPTED", "REJECTED",
  "FOLLOW_UP_NEEDED", "CLOSED",
]);

export async function adminUpdateApplicationStatus(
  id: string,
  status: string,
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<OpportunityApplicationRecord | undefined> {
  if (!VALID_APPLICATION_STATUSES.has(status as OpportunityApplicationStatus)) throw new Error(`Invalid status: ${status}`);
  return updateCivilianOpportunityApplicationStatus(id, status as OpportunityApplicationStatus, repository);
}

export async function adminUpdateSource(
  id: string,
  body: Record<string, unknown>,
  repository: CivilianJobsRepository = civilianJobsRepository,
): Promise<OpportunitySource | undefined> {
  const sources = await repository.listSources();
  const source = sources.find((item) => item.id === id);
  if (!source) return undefined;
  const updated: OpportunitySource = {
    ...source,
    enabled: body.enabled === undefined ? source.enabled : Boolean(body.enabled),
    notes: body.notes === undefined ? source.notes : safeString(body.notes),
    crawlPolicy: body.crawlPolicy === undefined ? source.crawlPolicy : body.crawlPolicy as OpportunitySource["crawlPolicy"],
  };
  return repository.saveSource(updated);
}
