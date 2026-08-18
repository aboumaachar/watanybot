/**
 * Wave 02 Admin service for Civilian Jobs & Services.
 *
 * Extends Wave01 service with admin-only CRUD and status transitions.
 * All opportunity state is held in-memory (Wave03 will add persistence).
 *
 * Boundary: إعلانات التطويع (military recruitment) is never managed here.
 */
import { civilianOpportunitySeed, civilianOpportunitySources } from "./civilian-jobs.seed.js";
import {
  listCivilianOpportunityApplications as _listApplications,
} from "./civilian-jobs.service.js";
import type {
  CivilianOpportunity,
  OpportunityApplicationRecord,
  OpportunityApplicationStatus,
  OpportunitySource,
  OpportunityStatus,
  OpportunityType,
  OpportunityAudience,
} from "./civilian-jobs.types.js";

// Re-export public reads so admin routes can use a single import
export { listCivilianOpportunityApplications, listCivilianOpportunitySources } from "./civilian-jobs.service.js";

function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
// Clone seed into a mutable array so admin operations don't mutate the seed.
const adminOpportunities: CivilianOpportunity[] = civilianOpportunitySeed.map((o) => ({ ...o }));
let nextSeq = adminOpportunities.length + 1;

// ── Sources (mutable) ────────────────────────────────────────────────
const adminSources: OpportunitySource[] = civilianOpportunitySources.map((s) => ({ ...s }));

// ── Filters ──────────────────────────────────────────────────────────
export interface AdminListFilters {
  status?: OpportunityStatus;
  q?: string;
}

export function adminListOpportunities(filters: AdminListFilters = {}): CivilianOpportunity[] {
  return adminOpportunities.filter((item) => {
    if (filters.status && item.status !== filters.status) return false;
    if (filters.q) {
      const hay = [item.title, item.organization, item.location, item.category, item.summary].join(" ").toLowerCase();
      if (!hay.includes(filters.q.toLowerCase())) return false;
    }
    return true;
  });
}

export function adminGetOpportunity(id: string): CivilianOpportunity | undefined {
  return adminOpportunities.find((o) => o.id === id);
}

// ── Create ────────────────────────────────────────────────────────────
export function adminCreateOpportunity(body: Record<string, unknown>): CivilianOpportunity {
  if (!body.title || !body.organization || !body.location || !body.type) {
    throw new Error("title, organization, location, and type are required.");
  }
  const now = new Date().toISOString();
  const item: CivilianOpportunity = {
    id: `opp-admin-${Date.now()}-${nextSeq++}`,
    type: (body.type as OpportunityType) || "PAID_JOB",
    audience: Array.isArray(body.audience) ? (body.audience as OpportunityAudience[]) : ["PUBLIC"],
    title: watanySafeStringField(body.title),
    organization: watanySafeStringField(body.organization),
    location: watanySafeStringField(body.location),
    category: String(watanySafeStringField(body.category)),
    summary: String(watanySafeStringField(body.summary)),
    description: String(watanySafeStringField(body.description)),
    requirements: Array.isArray(body.requirements) ? (body.requirements as string[]) : [],
    applicationMethod: String(watanySafeStringField(body.applicationMethod, "Apply via WatanyBot.")),
    sourceName: String(watanySafeStringField(body.sourceName, "Manual admin entry")),
    sourceUrl: String(watanySafeStringField(body.sourceUrl, "internal://manual")),
    deadline: body.deadline ? watanySafeStringField(body.deadline) : undefined,
    status: "DRAFT",
    adminVerified: false,
    createdAt: now,
    updatedAt: now,
  };
  adminOpportunities.push(item);
  return item;
}

// ── Update ────────────────────────────────────────────────────────────
export function adminUpdateOpportunity(id: string, body: Record<string, unknown>): CivilianOpportunity | undefined {
  const item = adminOpportunities.find((o) => o.id === id);
  if (!item) return undefined;
  const updatable: (keyof CivilianOpportunity)[] = [
    "title", "organization", "location", "category", "summary",
    "description", "requirements", "applicationMethod", "sourceName",
    "sourceUrl", "deadline", "audience", "type",
  ];
  for (const key of updatable) {
    if (body[key] !== undefined) {
      (item as unknown as Record<string, unknown>)[key] = body[key];
    }
  }
  item.updatedAt = new Date().toISOString();
  return item;
}

// ── Status transitions ────────────────────────────────────────────────
function setStatus(id: string, status: OpportunityStatus, adminVerified: boolean): CivilianOpportunity | undefined {
  const item = adminOpportunities.find((o) => o.id === id);
  if (!item) return undefined;
  item.status = status;
  item.adminVerified = adminVerified;
  item.updatedAt = new Date().toISOString();
  return item;
}

export function adminPublishOpportunity(id: string): CivilianOpportunity | undefined {
  return setStatus(id, "PUBLISHED", true);
}

export function adminArchiveOpportunity(id: string): CivilianOpportunity | undefined {
  return setStatus(id, "ARCHIVED", false);
}

export function adminRejectOpportunity(id: string): CivilianOpportunity | undefined {
  const item = adminOpportunities.find((o) => o.id === id);
  if (!item) return undefined;
  item.status = "ARCHIVED";
  item.adminVerified = false;
  item.updatedAt = new Date().toISOString();
  return item;
}

// ── Applications admin ────────────────────────────────────────────────
const VALID_APPLICATION_STATUSES = new Set<OpportunityApplicationStatus>([
  "NEW_APPLICATION", "PROFILE_INCOMPLETE", "REVIEWED", "MATCHED",
  "SENT_TO_EMPLOYER", "INTERVIEW_REQUESTED", "ACCEPTED", "REJECTED",
  "FOLLOW_UP_NEEDED", "CLOSED",
]);

export async function adminUpdateApplicationStatus(
  id: string,
  status: string,
): Promise<OpportunityApplicationRecord | undefined> {
  if (!VALID_APPLICATION_STATUSES.has(status as OpportunityApplicationStatus)) {
    throw new Error(`Invalid status: ${status}`);
  }
  // Applications are held in the service module's private array.
  // Access via the exported list and mutate by reference.
  const all = await _listApplications();
  const app = all.find((a) => a.id === id);
  if (!app) return undefined;
  app.status = status as OpportunityApplicationStatus;
  app.updatedAt = new Date().toISOString();
  return app;
}

// ── Sources admin ─────────────────────────────────────────────────────
export function adminUpdateSource(id: string, body: Record<string, unknown>): OpportunitySource | undefined {
  const src = adminSources.find((s) => s.id === id);
  if (!src) return undefined;
  if (body.enabled !== undefined) src.enabled = Boolean(body.enabled);
  if (body.notes !== undefined) src.notes = watanySafeStringField(body.notes);
  if (body.crawlPolicy !== undefined) src.crawlPolicy = body.crawlPolicy as OpportunitySource["crawlPolicy"];
  return src;
}
