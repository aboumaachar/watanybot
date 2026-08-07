import { describe, it, expect, beforeEach } from "vitest";
import {
  listSources,
  getSource,
  upsertSource,
  recordComplianceCheck,
  listComplianceChecks,
  startCrawlRun,
  completeCrawlRun,
  failCrawlRun,
  listCrawlRuns,
  ingestRawJob,
  listImportQueue,
  processImportReview,
  listCrawlItems,
} from "./civilian-jobs.aggregator.service.js";

// Unique source id per test file run to avoid cross-test state collisions
const SRC_ID = `test-src-wave03-${Date.now()}`;

/** Bring the test source to a known ready state: enabled + compliance approved. */
function setupReadySource() {
  upsertSource({
    id: SRC_ID,
    name: "Test Source Wave03",
    url: "https://example.com/jobs",
    sourceType: "JOB_BOARD",
    crawlPolicy: "PUBLIC_ALLOWED_REVIEW_REQUIRED",
    enabled: true,
  });
  recordComplianceCheck(SRC_ID, {
    robotsTxtAllows: true,
    termsApproved: true,
    requiresLogin: false,
    hasAntiBot: false,
    approved: true,
    notes: "Test compliance pass",
  });
}

describe("civilian jobs wave 03 aggregator service", () => {
  it("lists sources from seed registry", () => {
    const sources = listSources();
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources.some((s) => s.id === "manual")).toBe(true);
  });

  it("gets a source by id", () => {
    const src = getSource("manual");
    expect(src).toBeDefined();
    expect(src?.crawlPolicy).toBe("MANUAL_ONLY");
  });

  it("upserts a new source — starts disabled", () => {
    const newId = `new-src-${Date.now()}`;
    const src = upsertSource({
      id: newId,
      name: "Brand New Source",
      url: "https://example.com/new",
      sourceType: "JOB_BOARD",
      crawlPolicy: "PUBLIC_ALLOWED_REVIEW_REQUIRED",
    });
    expect(src.id).toBe(newId);
    expect(src.enabled).toBe(false); // must start disabled
  });

  it("updates an existing source via upsert", () => {
    const id = `upd-src-${Date.now()}`;
    upsertSource({ id, name: "Original", url: "https://example.com" });
    const updated = upsertSource({ id, name: "Updated Name", url: "https://example.com" });
    expect(updated.name).toBe("Updated Name");
  });

  it("records a compliance check and updates source approval", () => {
    const id = `comp-src-${Date.now()}`;
    upsertSource({ id, name: "Compliance Src", url: "https://example.com/c" });
    const check = recordComplianceCheck(id, {
      robotsTxtAllows: true,
      termsApproved: true,
      requiresLogin: false,
      hasAntiBot: false,
      approved: true,
      notes: "Manual review passed",
    });
    expect(check.approved).toBe(true);
    expect(getSource(id)?.complianceApproved).toBe(true);
  });

  it("lists compliance checks for a source", () => {
    const id = `comp-list-${Date.now()}`;
    upsertSource({ id, name: "List Compliance", url: "https://example.com/l" });
    recordComplianceCheck(id, {
      robotsTxtAllows: true, termsApproved: true,
      requiresLogin: false, hasAntiBot: false, approved: true, notes: "",
    });
    expect(listComplianceChecks(id).length).toBeGreaterThanOrEqual(1);
  });

  it("blocks crawl run on disabled source", () => {
    const id = `disabled-src-${Date.now()}`;
    upsertSource({ id, name: "Disabled", url: "https://example.com/d", enabled: false });
    expect(() => startCrawlRun(id)).toThrow(/disabled/i);
  });

  it("blocks crawl run on non-compliance-approved source", () => {
    const id = `nocomp-src-${Date.now()}`;
    upsertSource({
      id, name: "No Compliance", url: "https://example.com/nc",
      enabled: true, crawlPolicy: "PUBLIC_ALLOWED_REVIEW_REQUIRED",
    });
    expect(() => startCrawlRun(id)).toThrow(/compliance/i);
  });

  it("allows crawl run after enabling + compliance approved", () => {
    setupReadySource();
    const run = startCrawlRun(SRC_ID);
    expect(run.status).toBe("RUNNING");
    const completed = completeCrawlRun(run.id, {
      itemsDiscovered: 3, itemsNormalized: 2, itemsDuplicate: 1, itemsQueued: 2,
    });
    expect(completed.status).toBe("COMPLETED");
    expect(completed.itemsDiscovered).toBe(3);
  });

  it("fails a crawl run", () => {
    setupReadySource();
    const run = startCrawlRun(SRC_ID);
    const failed = failCrawlRun(run.id, "Connection timeout");
    expect(failed.status).toBe("FAILED");
    expect(failed.errorMessage).toBe("Connection timeout");
  });

  it("lists crawl runs filtered by source", () => {
    setupReadySource();
    startCrawlRun(SRC_ID);
    expect(listCrawlRuns(SRC_ID).length).toBeGreaterThanOrEqual(1);
  });

  let runId: string;
  beforeEach(() => {
    setupReadySource();
    const run = startCrawlRun(SRC_ID);
    runId = run.id;
  });

  it("ingests a new raw job and creates an import review item", () => {
    const url = `https://example.com/jobs/ingest-${Date.now()}`;
    const { crawlItem, imported } = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source Wave03",
      rawTitle: "Software Engineer Beirut", rawOrganization: "TechCo Lebanon",
      rawLocation: "Beirut", rawUrl: url, rawCategory: "tech",
    });
    expect(crawlItem.importStatus).toBe("NORMALIZED");
    expect(imported).toBeDefined();
    expect(imported!.importStatus).toBe("NEEDS_ADMIN_REVIEW");
    expect(imported!.normalizedTitle).toBe("Software Engineer Beirut");
  });

  it("deduplicates the same URL+title combination", () => {
    const url = `https://example.com/jobs/dedup-${Date.now()}`;
    const first = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "Unique Job For Dedup", rawUrl: url,
    });
    const second = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "Unique Job For Dedup", rawUrl: url,
    });
    expect(first.crawlItem.importStatus).toBe("NORMALIZED");
    expect(second.crawlItem.importStatus).toBe("DUPLICATE_SKIPPED");
    expect(second.imported).toBeUndefined();
  });

  it("lists crawl items", () => {
    ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "List Test Job", rawUrl: `https://example.com/jobs/list-${Date.now()}`,
    });
    expect(listCrawlItems(runId).length).toBeGreaterThanOrEqual(1);
  });

  it("lists import queue", () => {
    expect(Array.isArray(listImportQueue("NEEDS_ADMIN_REVIEW"))).toBe(true);
  });

  it("approves an import and creates a published opportunity", () => {
    const { imported } = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "Approved Import Job", rawUrl: `https://example.com/jobs/approve-${Date.now()}`,
    });
    expect(imported).toBeDefined();
    const reviewed = processImportReview({
      importedOpportunityId: imported!.id,
      decision: "APPROVE",
      adminNote: "Looks legitimate",
    });
    expect(reviewed.importStatus).toBe("APPROVED_FOR_PUBLICATION");
    expect(reviewed.publishedOpportunityId).toBeDefined();
  });

  it("rejects an import", () => {
    const { imported } = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "Rejected Import Job", rawUrl: `https://example.com/jobs/reject-${Date.now()}`,
    });
    const reviewed = processImportReview({
      importedOpportunityId: imported!.id,
      decision: "REJECT",
      adminNote: "Duplicate or low quality",
    });
    expect(reviewed.importStatus).toBe("REJECTED");
    expect(reviewed.publishedOpportunityId).toBeUndefined();
  });

  it("throws when reviewing a non-pending item twice", () => {
    const { imported } = ingestRawJob({
      crawlRunId: runId, sourceId: SRC_ID, sourceName: "Test Source",
      rawTitle: "Double Review Job", rawUrl: `https://example.com/jobs/double-${Date.now()}`,
    });
    processImportReview({ importedOpportunityId: imported!.id, decision: "APPROVE" });
    expect(() =>
      processImportReview({ importedOpportunityId: imported!.id, decision: "REJECT" }),
    ).toThrow();
  });
});
