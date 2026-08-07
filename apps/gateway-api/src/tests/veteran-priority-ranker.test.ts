import { describe, expect, it } from "vitest";
import { rankVeteranPriorityRecords } from "../features/veteran-priority/veteran-priority-ranker";

describe("gateway veteran-priority ranker", () => {
  it("prioritizes veteran/family law content ahead of generic law entries", () => {
    const records = [
      {
        id: "generic-law",
        sourceType: "laws",
        sourceTitle: "قانون الدفاع الوطني",
        title: "تنظيم عام",
        body: "مادة عامة في قانون الدفاع الوطني تتعلق بتنظيم اداري عام دون تفاصيل استحقاقات.",
      },
      {
        id: "family-law",
        sourceType: "laws",
        sourceTitle: "قانون الدفاع الوطني",
        title: "حقوق العائلة للعسكريين المتقاعدين",
        body: "تتناول هذه المادة حقوق الابن والابنة والزوج والزوجة للعسكريين المتقاعدين.",
      },
    ];

    const ranked = rankVeteranPriorityRecords(records, "قانون الدفاع الوطني");
    expect(ranked[0]?.item.id).toBe("family-law");
  });

  it("does not treat neutral service terms as veteran-priority signals", () => {
    const records = [
      {
        id: "neutral-taqib",
        sourceType: "listing",
        title: "تعقيب معاملات",
        body: "خدمة عامة لمتابعة الاوراق في المؤسسات العامة.",
      },
    ];

    const ranked = rankVeteranPriorityRecords(records, "تعقيب معاملات");
    expect(ranked[0]?.score.isVeteranPriority).toBe(false);
    expect((ranked[0]?.score.ignoredNeutralServiceTerms.length ?? 0)).toBeGreaterThan(0);
  });
});
