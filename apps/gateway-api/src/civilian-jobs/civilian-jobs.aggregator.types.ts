/**
 * Wave 03 — Aggregation types for Lebanese job import pipeline.
 * Extends civilian-jobs.types.ts without modifying it.
 */

export type ImportStatus =
  | "DISCOVERED"
  | "NORMALIZED"
  | "DUPLICATE_SKIPPED"
  | "NEEDS_ADMIN_REVIEW"
  | "APPROVED_FOR_PUBLICATION"
  | "REJECTED"
  | "EXPIRED"
  | "SOURCE_BLOCKED"
  | "CRAWL_FAILED";

export type CrawlPolicy =
  | "MANUAL_ONLY"
  | "RSS_OR_API_FIRST"
  | "PUBLIC_ALLOWED_REVIEW_REQUIRED";

export type SourceType =
  | "JOB_BOARD"
  | "NGO"
  | "UN_AGENCY"
  | "UNIVERSITY"
  | "EMPLOYER"
  | "GOVERNMENT"
  | "MANUAL";

export type CrawlRunStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "BLOCKED_BY_COMPLIANCE";

/** A registered Lebanese job source. */
export interface JobSource {
  id: string;
  name: string;
  url: string;
  sourceType: SourceType;
  crawlPolicy: CrawlPolicy;
  enabled: boolean;
  complianceApproved: boolean;
  complianceNotes: string;
  lastCheckedAt?: string;
  createdAt: string;
  updatedAt: string;
}

/** One execution run of a source adapter. */
export interface JobCrawlRun {
  id: string;
  sourceId: string;
  sourceName: string;
  startedAt: string;
  endedAt?: string;
  status: CrawlRunStatus;
  itemsDiscovered: number;
  itemsNormalized: number;
  itemsDuplicate: number;
  itemsQueued: number;
  errorMessage?: string;
}

/** A single raw item discovered from a source. */
export interface JobCrawlItem {
  id: string;
  crawlRunId: string;
  sourceId: string;
  sourceName: string;
  rawTitle: string;
  rawOrganization?: string;
  rawLocation?: string;
  rawUrl: string;
  rawPostedAt?: string;
  rawCategory?: string;
  importStatus: ImportStatus;
  dedupeFingerprint: string;
  discoveredAt: string;
}

/** A crawl item after normalization, awaiting admin review. */
export interface ImportedOpportunity {
  id: string;
  crawlItemId: string;
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  normalizedTitle: string;
  normalizedOrganization: string;
  normalizedLocation: string;
  normalizedCategory: string;
  normalizedSummary: string;
  normalizedType: string;
  importStatus: ImportStatus;
  adminReviewNote?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  publishedOpportunityId?: string;
  importedAt: string;
  updatedAt: string;
}

/** Admin review decision for an imported opportunity. */
export interface ImportReviewDecision {
  importedOpportunityId: string;
  decision: "APPROVE" | "REJECT";
  adminNote?: string;
}

/** Compliance check record for a source. */
export interface SourceComplianceCheck {
  id: string;
  sourceId: string;
  checkedAt: string;
  robotsTxtAllows: boolean;
  termsApproved: boolean;
  requiresLogin: boolean;
  hasAntiBot: boolean;
  approved: boolean;
  notes: string;
}
