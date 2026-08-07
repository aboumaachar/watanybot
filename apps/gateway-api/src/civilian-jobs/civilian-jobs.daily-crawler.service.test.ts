import { describe, expect, it } from "vitest";
import { listLebaneseJobSources } from "./civilian-jobs.lebanese-source-coverage";
import { buildDailyCrawlerPolicyGates, normalizeImportedListing, simulateDailyCrawlRun } from "./civilian-jobs.daily-crawler.service";

describe("civilian jobs Lebanese source coverage and daily crawler", () => {
  it("keeps source registry admin-review-only", () => {
    const sources = listLebaneseJobSources();
    expect(sources.length).toBeGreaterThanOrEqual(10);
    expect(sources.every((source) => source.autoPublish === false)).toBe(true);
    expect(sources.every((source) => source.adminReviewRequired === true)).toBe(true);
  });

  it("normalizes imported listings into pending review", () => {
    const listing = normalizeImportedListing({
      sourceId: "daleel-madani",
      sourceUrl: "https://example.test/job/1",
      title: "Field Coordinator",
      company: "NGO",
      location: "Beirut"
    });
    expect(listing.status).toBe("PENDING_REVIEW");
    expect(listing.dedupeKey).toContain("field coordinator");
  });

  it("builds policy gates before crawling", () => {
    const gates = buildDailyCrawlerPolicyGates();
    expect(gates.length).toBeGreaterThan(0);
    expect(gates.some((gate) => gate.sourceId === "manual-facebook-instagram-whatsapp" && gate.allowedToFetch === false)).toBe(true);
  });

  it("simulates daily crawl without auto-publishing", () => {
    const result = simulateDailyCrawlRun();
    expect(result.run.status).toBe("COMPLETED");
    expect(result.importedListings.every((listing) => listing.status === "PENDING_REVIEW")).toBe(true);
  });
});