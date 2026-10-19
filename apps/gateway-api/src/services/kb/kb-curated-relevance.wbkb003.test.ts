import { describe, expect, it } from "vitest";
import { searchKbLive } from "./kb-search.service";
import { runHybridKbChat } from "../chat/hybrid-chat.service";

/**
 * WB-KB-003: only locally indexed, externally verified page URLs.
 * These cases prove selection fidelity, not legal correctness of an answer.
 */
const focused = [
  ["pension certificate", "كيف أحصل على إفادة معاش التقاعد؟", "wbkb-finance-pension-certificate", "eservices.finance.gov.lb"],
  ["retirement procedure", "ما مستندات طلب نسخة عن مستند التسريح أو الإحالة على التقاعد؟", "wbkb-army-retirement-paper-copy", "lebarmy.gov.lb"],
  ["school paper settlement", "ما مستندات تسوية أوراق مدرسية؟", "wbkb-army-school-paper-correction", "lebarmy.gov.lb"],
  ["overdue school grant", "ما مستندات المساعدات المدرسية المتأخرة؟", "wbkb-army-school-overdue-grant", "lebarmy.gov.lb"],
  ["medical declaration", "ما مستندات تصريح الاستفادة من الطبابة؟", "wbkb-army-medical-benefit-declaration", "lebarmy.gov.lb"],
] as const;

describe("WB-KB-003: verified-page scope and relevance on real local index", () => {
  it.each(focused)("prioritizes applicable official-page reference for %s", async (_, query, wantedId, hostname) => {
    const response = await searchKbLive(query, { limit: 8 });
    const top = response.documents[0];
    expect(top?.id).toBe(wantedId);
    expect(top?.referenceTier).toBe("curated_official");
    expect(top.sourceUrl).toContain(hostname);
    expect(top.sourcePath).toContain("wb-kb-curated-references-20261016.json");
    expect(top.score).toBeGreaterThan(0);
    expect(response.documents.every((doc) => !doc.sourcePath?.startsWith("seed:"))).toBe(true);
    expect(response.documents.every((doc) => !/demo-readiness|admin-payments/i.test(doc.title))).toBe(true);
  });

  it("does not cite a pension certificate service as the legal rules for pension eligibility", async () => {
    const result = await searchKbLive("ما هي شروط استحقاق معاش التقاعد؟", { limit: 8 });
    expect(result.documents.some((doc) => doc.id === "wbkb-finance-pension-certificate")).toBe(false);
  });

  it("does not invent a specific administrative procedure from an unspecified transaction question", async () => {
    const message = "ما هي المستندات اللازمة للمعاملة؟";
    const search = await searchKbLive(message, { limit: 8 });
    expect(search.documents).toHaveLength(0);
    const answer = await runHybridKbChat({ message });
    expect(answer.mode).toBe("clarification-required");
    expect(answer.confidence).toBe(0);
    expect(answer.sources).toEqual([]);
    expect(answer.answer).toContain("لم أجد نتيجة كافية");
  });

  it("does not substitute an unrelated ministry homepage for general school grant requirements", async () => {
    const res = await searchKbLive("ما هي مستندات المساعدات المدرسية؟", { limit: 8 });
    expect(res.documents.every((doc) => /مدرس|تعليم|school/i.test([doc.title, ...doc.tags].join(" ")))).toBe(true);
    expect(res.documents.some((doc) => /الجمارك|الضمان الاجتماعي|admin-payments/i.test(doc.title))).toBe(false);
  });

  it("keeps source records bounded to known reviewed authority pages rather than generated URL guesses", async () => {
    const result = await searchKbLive("طلب منح مساعدات مدرسية متأخرة", { limit: 8 });
    const official = result.documents.filter((d) => d.referenceTier === "curated_official");
    expect(official.length).toBeGreaterThan(0);
    for (const doc of official) {
      const url = new URL(doc.sourceUrl!);
      expect(url.protocol).toBe("https:");
      expect(["www.lebarmy.gov.lb", "eservices.finance.gov.lb"]).toContain(url.hostname);
    }
  });
});
