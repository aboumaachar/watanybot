/**
 * Wave 03 — Source registry, crawler run management, normalizer,
 * deduplication, and import review queue (in-memory MVP).
 *
 * Rule: imported opportunities are NEVER published automatically.
 *       They enter NEEDS_ADMIN_REVIEW and require explicit approval.
 *
 * Boundary: إعلانات التطويع is untouched here.
 */
import type {
  ImportedOpportunity,
  ImportReviewDecision,
  ImportStatus,
  JobCrawlItem,
  JobCrawlRun,
  JobSource,
  SourceComplianceCheck,
} from "./civilian-jobs.aggregator.types.js";
import { civilianOpportunitySources } from "./civilian-jobs.seed.js";
import { adminCreateOpportunity, adminPublishOpportunity } from "./civilian-jobs.admin.service.js";

// ── Source Registry ───────────────────────────────────────────────────────────

const sourceRegistry: JobSource[] = civilianOpportunitySources.map((s) => ({
  id: s.id,
  name: s.name,
  url: s.url,
  sourceType: s.sourceType,
  crawlPolicy: s.crawlPolicy,
  enabled: s.enabled,
  complianceApproved: s.crawlPolicy === "MANUAL_ONLY",
  complianceNotes: s.notes,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}));

export function listSources(): JobSource[] {
  return [...sourceRegistry];
}

export function getSource(id: string): JobSource | undefined {
  return sourceRegistry.find((s) => s.id === id);
}

export function upsertSource(data: Partial<JobSource> & { id: string; name: string; url: string }): JobSource {
  const existing = sourceRegistry.find((s) => s.id === data.id);
  const now = new Date().toISOString();
  if (existing) {
    Object.assign(existing, data, { updatedAt: now });
    return existing;
  }
  const src: JobSource = {
    sourceType: "JOB_BOARD",
    crawlPolicy: "MANUAL_ONLY",
    enabled: false,
    complianceApproved: false,
    complianceNotes: "",
    createdAt: now,
    updatedAt: now,
    ...data,
  };
  sourceRegistry.push(src);
  return src;
}

// ── Compliance checks ─────────────────────────────────────────────────────────

const complianceChecks: SourceComplianceCheck[] = [];

export function recordComplianceCheck(
  sourceId: string,
  check: Omit<SourceComplianceCheck, "id" | "sourceId" | "checkedAt">,
): SourceComplianceCheck {
  const record: SourceComplianceCheck = {
    id: `compliance-${Date.now()}`,
    sourceId,
    checkedAt: new Date().toISOString(),
    ...check,
  };
  complianceChecks.push(record);
  // Update source approval state
  const src = sourceRegistry.find((s) => s.id === sourceId);
  if (src) {
    src.complianceApproved = check.approved;
    src.lastCheckedAt = record.checkedAt;
    src.updatedAt = record.checkedAt;
  }
  return record;
}

export function listComplianceChecks(sourceId?: string): SourceComplianceCheck[] {
  return sourceId ? complianceChecks.filter((c) => c.sourceId === sourceId) : [...complianceChecks];
}

// ── Crawl runs ────────────────────────────────────────────────────────────────

const crawlRuns: JobCrawlRun[] = [];

export function startCrawlRun(sourceId: string): JobCrawlRun {
  const src = sourceRegistry.find((s) => s.id === sourceId);
  if (!src) throw new Error(`Source not found: ${sourceId}`);
  if (!src.enabled) throw new Error(`Source is disabled: ${sourceId}`);
  if (!src.complianceApproved && src.crawlPolicy !== "MANUAL_ONLY") {
    throw new Error(`Source ${sourceId} has not passed compliance review.`);
  }
  const run: JobCrawlRun = {
    id: `run-${Date.now()}`,
    sourceId,
    sourceName: src.name,
    startedAt: new Date().toISOString(),
    status: "RUNNING",
    itemsDiscovered: 0,
    itemsNormalized: 0,
    itemsDuplicate: 0,
    itemsQueued: 0,
  };
  crawlRuns.push(run);
  return run;
}

export function completeCrawlRun(
  runId: string,
  stats: Pick<JobCrawlRun, "itemsDiscovered" | "itemsNormalized" | "itemsDuplicate" | "itemsQueued">,
): JobCrawlRun {
  const run = crawlRuns.find((r) => r.id === runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  run.status = "COMPLETED";
  run.endedAt = new Date().toISOString();
  Object.assign(run, stats);
  return run;
}

export function failCrawlRun(runId: string, errorMessage: string): JobCrawlRun {
  const run = crawlRuns.find((r) => r.id === runId);
  if (!run) throw new Error(`Run not found: ${runId}`);
  run.status = "FAILED";
  run.endedAt = new Date().toISOString();
  run.errorMessage = errorMessage;
  return run;
}

export function listCrawlRuns(sourceId?: string): JobCrawlRun[] {
  return sourceId ? crawlRuns.filter((r) => r.sourceId === sourceId) : [...crawlRuns];
}

// ── Deduplication ─────────────────────────────────────────────────────────────

const dedupeFingerprintsSeen = new Set<string>();

function makeFingerprint(rawUrl: string, rawTitle: string, rawOrg?: string): string {
  return [rawUrl.toLowerCase().trim(), rawTitle.toLowerCase().trim(), (rawOrg || "").toLowerCase().trim()].join("|");
}

// ── Crawl items + normalizer ──────────────────────────────────────────────────

const crawlItems: JobCrawlItem[] = [];
const importedOpportunities: ImportedOpportunity[] = [];

export interface RawJobInput {
  crawlRunId: string;
  sourceId: string;
  sourceName: string;
  rawTitle: string;
  rawOrganization?: string;
  rawLocation?: string;
  rawUrl: string;
  rawPostedAt?: string;
  rawCategory?: string;
}

/**
 * Ingest a raw item from a source adapter.
 * Runs deduplication then normalization.
 * Duplicate items are stored with DUPLICATE_SKIPPED status.
 * New items are normalized and placed in NEEDS_ADMIN_REVIEW queue.
 */
export function ingestRawJob(input: RawJobInput): { crawlItem: JobCrawlItem; imported?: ImportedOpportunity } {
  const fingerprint = makeFingerprint(input.rawUrl, input.rawTitle, input.rawOrganization);
  const now = new Date().toISOString();

  const crawlItem: JobCrawlItem = {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    crawlRunId: input.crawlRunId,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    rawTitle: input.rawTitle,
    rawOrganization: input.rawOrganization,
    rawLocation: input.rawLocation,
    rawUrl: input.rawUrl,
    rawPostedAt: input.rawPostedAt,
    rawCategory: input.rawCategory,
    importStatus: "DISCOVERED",
    dedupeFingerprint: fingerprint,
    discoveredAt: now,
  };
  crawlItems.push(crawlItem);

  if (dedupeFingerprintsSeen.has(fingerprint)) {
    crawlItem.importStatus = "DUPLICATE_SKIPPED";
    return { crawlItem };
  }
  dedupeFingerprintsSeen.add(fingerprint);

  // Normalize
  const normalized: ImportedOpportunity = {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    crawlItemId: crawlItem.id,
    sourceId: input.sourceId,
    sourceName: input.sourceName,
    sourceUrl: input.rawUrl,
    normalizedTitle: normalizeTitle(input.rawTitle),
    normalizedOrganization: input.rawOrganization || "غير محدد",
    normalizedLocation: input.rawLocation || "لبنان",
    normalizedCategory: input.rawCategory || "عام",
    normalizedSummary: `مستورد من ${input.sourceName}. يحتاج مراجعة إدارية قبل النشر.`,
    normalizedType: guessType(input.rawCategory),
    importStatus: "NEEDS_ADMIN_REVIEW",
    importedAt: now,
    updatedAt: now,
  };
  crawlItem.importStatus = "NORMALIZED";
  importedOpportunities.push(normalized);
  return { crawlItem, imported: normalized };
}

function normalizeTitle(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

function guessType(category?: string): string {
  if (!category) return "PAID_JOB";
  const c = category.toLowerCase();
  if (c.includes("volunteer") || c.includes("تطوع")) return "VOLUNTEER_WORK";
  if (c.includes("intern") || c.includes("تدريب")) return "INTERNSHIP";
  if (c.includes("freelance") || c.includes("حر")) return "FREELANCE_SERVICE";
  if (c.includes("part") || c.includes("جزئي")) return "PART_TIME_JOB";
  return "PAID_JOB";
}

// ── Import review queue ───────────────────────────────────────────────────────

export function listImportQueue(status?: ImportStatus): ImportedOpportunity[] {
  return status ? importedOpportunities.filter((i) => i.importStatus === status) : [...importedOpportunities];
}

export function getImportedOpportunity(id: string): ImportedOpportunity | undefined {
  return importedOpportunities.find((i) => i.id === id);
}

/**
 * Admin approves or rejects an imported opportunity.
 * Approval creates a DRAFT civilian opportunity via the admin service,
 * then auto-publishes it (admin explicitly chose to approve = publish).
 * Never auto-publishes without an explicit admin decision.
 */
export function processImportReview(decision: ImportReviewDecision, reviewedBy = "admin"): ImportedOpportunity {
  const item = importedOpportunities.find((i) => i.id === decision.importedOpportunityId);
  if (!item) throw new Error(`Imported opportunity not found: ${decision.importedOpportunityId}`);
  if (item.importStatus !== "NEEDS_ADMIN_REVIEW") {
    throw new Error(`Item ${item.id} is not pending review (status: ${item.importStatus}).`);
  }

  const now = new Date().toISOString();
  item.adminReviewNote = decision.adminNote;
  item.reviewedBy = reviewedBy;
  item.reviewedAt = now;
  item.updatedAt = now;

  if (decision.decision === "APPROVE") {
    item.importStatus = "APPROVED_FOR_PUBLICATION";
    // Create and immediately publish a civilian opportunity from this import
    const opp = adminCreateOpportunity({
      title: item.normalizedTitle,
      organization: item.normalizedOrganization,
      location: item.normalizedLocation,
      category: item.normalizedCategory,
      summary: item.normalizedSummary,
      type: item.normalizedType,
      sourceName: item.sourceName,
      sourceUrl: item.sourceUrl,
      description: `مستورد من ${item.sourceName}. تمت المراجعة الإدارية والموافقة على النشر.`,
    });
    adminPublishOpportunity(opp.id);
    item.publishedOpportunityId = opp.id;
  } else {
    item.importStatus = "REJECTED";
  }

  return item;
}

export function listCrawlItems(crawlRunId?: string): JobCrawlItem[] {
  return crawlRunId ? crawlItems.filter((c) => c.crawlRunId === crawlRunId) : [...crawlItems];
}
