export type CrawlRunStatus = "SCHEDULED" | "RUNNING" | "COMPLETED" | "FAILED" | "SKIPPED_POLICY";
export type ImportedListingStatus = "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "DUPLICATE";

export interface DailyCrawlerPolicyGate {
  sourceId: string;
  robotsChecked: boolean;
  termsChecked: boolean;
  allowedToFetch: boolean;
  allowReason: string;
  checkedAt: string;
}

export interface NormalizedImportedJobListing {
  importId: string;
  sourceId: string;
  sourceUrl: string;
  title: string;
  company?: string;
  location?: string;
  deadline?: string;
  employmentType?: string;
  rawSummary?: string;
  dedupeKey: string;
  status: ImportedListingStatus;
  createdAt: string;
}

export interface DailyCrawlRun {
  runId: string;
  startedAt: string;
  endedAt?: string;
  status: CrawlRunStatus;
  sourceCount: number;
  importedCount: number;
  duplicateCount: number;
  skippedCount: number;
  failureCount: number;
  note: string;
}

export interface DailyCrawlerResult {
  run: DailyCrawlRun;
  policyGates: DailyCrawlerPolicyGate[];
  importedListings: NormalizedImportedJobListing[];
}