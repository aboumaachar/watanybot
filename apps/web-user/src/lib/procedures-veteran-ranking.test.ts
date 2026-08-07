import { describe, expect, it } from "vitest";

import {
  getProcedureVeteranRelevance,
  getSectionVeteranRelevanceScore,
  sortByProcedureVeteranRelevance,
  type ProcedureRankable,
} from "./procedures-veteran-ranking";

function makeProcedure(overrides: Partial<ProcedureRankable> = {}): ProcedureRankable {
  return {
    id: "proc-1",
    title_ar: "إجراء عام",
    summary_lb: "ملخص",
    tags: [],
    applies_to: [],
    ...overrides,
  };
}

describe("procedures veteran ranking", () => {
  it("scores direct veteran content above generic admin content", () => {
    const veteranDirect = makeProcedure({
      id: "veteran",
      title_ar: "طلب معاش للمتقاعد",
      audience_scope: "retired_army_only",
      content_tier: "frontline",
      domain: "pension",
    });

    const genericAdmin = makeProcedure({
      id: "admin",
      title_ar: "إجراء إداري عام",
      audience_scope: "institutional_admin",
      content_tier: "archive",
      domain: "general",
    });

    expect(getProcedureVeteranRelevance(veteranDirect)).toBeGreaterThan(getProcedureVeteranRelevance(genericAdmin));
  });

  it("sorts entries descending by veteran relevance", () => {
    const items = [
      makeProcedure({ id: "general", title_ar: "مراجعة عامة", audience_scope: "public_general" }),
      makeProcedure({ id: "family", title_ar: "معاملة للأرملة", audience_scope: "family_direct", domain: "death_inheritance" }),
      makeProcedure({ id: "retired", title_ar: "طلب للمتقاعد", audience_scope: "retired_army_only", domain: "pension" }),
    ];

    const sorted = sortByProcedureVeteranRelevance(items).map((item) => item.id);

    expect(sorted).toEqual(["retired", "family", "general"]);
  });

  it("uses highest ranked cards to compute section relevance score", () => {
    const procedures = [
      makeProcedure({ id: "general", title_ar: "عام", audience_scope: "public_general" }),
      makeProcedure({ id: "retired", title_ar: "تقاعد", audience_scope: "retired_army_only", domain: "pension" }),
    ];

    const notices = [
      makeProcedure({ id: "notice", title_ar: "تنبيه عائلي", audience_scope: "family_direct" }),
    ];

    const references = [
      makeProcedure({ id: "reference", title_ar: "مرجع إداري", audience_scope: "institutional_admin" }),
    ];

    const score = getSectionVeteranRelevanceScore(procedures, notices, references);

    expect(score).toBe(getProcedureVeteranRelevance(procedures[1]));
  });
});