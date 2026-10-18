import { describe, expect, it } from "vitest";
import { searchKbLive } from "./kb-search.service";

/** Read-only local KB discovery. Candidate retrieval does not certify an official source or factual correctness. */
const queries = [
  ["pension", "ما هي شروط معاش التقاعد؟"],
  ["healthcare", "كيف استفيد من الطبابة والاستشفاء؟"],
  ["school-grants", "ما هي مستندات المساعدات المدرسية؟"],
  ["procedures", "ما هي المستندات اللازمة للمعاملة؟"],
] as const;

describe("WB-CHAT-002 local KB retrieval diagnostic — NO application API, no writes", () => {
  it.each(queries)("reports actual local index coverage for %s", async (domain, query) => {
    const result = await searchKbLive(query, { limit: 5 });
    const inspectable = result.documents.filter((x) => Boolean(x.sourceUrl?.trim()));
    const seeded = result.documents.filter((x) => x.id.startsWith("fallback-") || x.sourcePath?.startsWith("seed:"));
    const types = result.documents.map((x) => x.sourceType);
    console.info("WB_KB_DIAGNOSTIC", JSON.stringify({
      domain,
      indexedRecords: result.indexStats.records,
      scannedSources: result.indexStats.sources,
      returned: result.documents.length,
      linked: inspectable.length,
      syntheticOrFallback: seeded.length,
      types,
      topTitles: result.documents.slice(0, 3).map((x) => x.title.slice(0, 90)),
    }));
    expect(result.query).toBe(query);
    expect(Array.isArray(result.documents)).toBe(true);
    expect(result.indexStats.records).toBeGreaterThan(0);
    if (domain === "procedures") {
      expect(result.documents).toHaveLength(0); // Generic unspecified transaction: clarification is safer.
    } else {
      expect(result.documents.every((item) => item.referenceTier !== undefined)).toBe(true);
    }
  });
});
