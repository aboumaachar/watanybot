import { listLebaneseJobSources } from "./civilian-jobs.lebanese-source-coverage";
import type { DailyCrawlerPolicyGate, DailyCrawlerResult, DailyCrawlRun, NormalizedImportedJobListing } from "./civilian-jobs.daily-crawler.types";

function nowIso(): string {
  return new Date().toISOString();
}

export function buildDedupeKey(input: { sourceId: string; title: string; company?: string; location?: string; sourceUrl?: string }): string {
  return [input.sourceId, input.title, input.company ?? "", input.location ?? "", input.sourceUrl ?? ""]
    .join("|")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDailyCrawlerPolicyGates(): DailyCrawlerPolicyGate[] {
  return listLebaneseJobSources().map((source) => ({
    sourceId: source.sourceId,
    robotsChecked: source.url.startsWith("manual://") ? false : true,
    termsChecked: false,
    allowedToFetch: source.crawlFrequency === "DAILY_IF_ALLOWED" && !source.url.startsWith("manual://"),
    allowReason: source.url.startsWith("manual://")
      ? "Manual/social source: do not crawl private channels."
      : "Eligible for adapter only after policy/terms review; import remains pending admin review.",
    checkedAt: nowIso()
  }));
}

export function normalizeImportedListing(input: {
  sourceId: string;
  sourceUrl: string;
  title: string;
  company?: string;
  location?: string;
  deadline?: string;
  employmentType?: string;
  rawSummary?: string;
}): NormalizedImportedJobListing {
  const createdAt = nowIso();
  return {
    importId: `imp-${input.sourceId}-${Math.abs(buildDedupeKey(input).split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0))}`,
    sourceId: input.sourceId,
    sourceUrl: input.sourceUrl,
    title: input.title.trim(),
    company: input.company?.trim(),
    location: input.location?.trim(),
    deadline: input.deadline?.trim(),
    employmentType: input.employmentType?.trim(),
    rawSummary: input.rawSummary?.trim(),
    dedupeKey: buildDedupeKey(input),
    status: "PENDING_REVIEW",
    createdAt
  };
}

export function simulateDailyCrawlRun(): DailyCrawlerResult {
  const sources = listLebaneseJobSources();
  const policyGates = buildDailyCrawlerPolicyGates();
  const importedListings: NormalizedImportedJobListing[] = [];
  const run: DailyCrawlRun = {
    runId: `crawl-${Date.now()}`,
    startedAt: nowIso(),
    endedAt: nowIso(),
    status: "COMPLETED",
    sourceCount: sources.length,
    importedCount: importedListings.length,
    duplicateCount: 0,
    skippedCount: policyGates.filter((gate) => !gate.allowedToFetch).length,
    failureCount: 0,
    note: "Scaffold run: adapters are policy-gated. Real crawling must plug source-specific adapters and import into admin review queue only."
  };
  return { run, policyGates, importedListings };
}