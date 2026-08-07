import { describe, expect, it } from "vitest";

import type { FormListItem, FormSourceCard } from "./api";
import {
  getFormVeteranRelevance,
  getSourceVeteranRelevance,
  sortFormsByVeteranRelevance,
} from "./forms-veteran-ranking";

function makeForm(overrides: Partial<FormListItem> = {}): FormListItem {
  return {
    id: "form-1",
    code: "F-1",
    title_ar: "نموذج عام",
    description_ar: "وصف",
    category: "general",
    related_tx: [],
    authority: "مرجع عام",
    fields: [],
    version: "1",
    updatedAt: "2026-05-24",
    sourceId: "other",
    sourceName: "مصدر",
    tags: [],
    ...overrides,
  };
}

describe("forms veteran ranking", () => {
  it("scores pension-retirement forms above generic admin forms", () => {
    const retiredForm = makeForm({
      id: "retired",
      sourceId: "retirement",
      title_ar: "طلب إفادة معاش تقاعدي",
      description_ar: "معاملة للمتقاعد",
    });

    const adminForm = makeForm({
      id: "admin",
      sourceId: "admin",
      title_ar: "إفادة إدارية عامة",
      description_ar: "نموذج إداري",
    });

    expect(getFormVeteranRelevance(retiredForm)).toBeGreaterThan(getFormVeteranRelevance(adminForm));
  });

  it("sorts forms descending by veteran relevance", () => {
    const forms = [
      makeForm({ id: "general", sourceId: "other", title_ar: "إفادة عامة" }),
      makeForm({ id: "family", sourceId: "compensation", title_ar: "طلب تعويض عائلي" }),
      makeForm({ id: "retired", sourceId: "retirement", title_ar: "طلب معاش تقاعدي" }),
    ];

    const sorted = sortFormsByVeteranRelevance(forms).map((form) => form.id);
    expect(sorted).toEqual(["retired", "family", "general"]);
  });

  it("ranks veteran-focused sources above generic ones", () => {
    const retirementSource: FormSourceCard = {
      sourceId: "retirement",
      sourceName: "مديرية التقاعد",
      formCount: 5,
    };

    const adminSource: FormSourceCard = {
      sourceId: "admin",
      sourceName: "إدارية",
      formCount: 20,
    };

    expect(getSourceVeteranRelevance(retirementSource)).toBeGreaterThan(getSourceVeteranRelevance(adminSource));
  });
});