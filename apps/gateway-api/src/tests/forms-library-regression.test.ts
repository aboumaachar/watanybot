import Fastify from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { formsInlineRoutes } from "../routes/forms-inline";
import { getFormsCatalog } from "../data/forms-catalog";

type MockForm = {
  id: string;
  code: string;
  title_ar: string;
  description_ar: string;
  category: string;
  authority: string;
  fields: unknown[];
  related_tx: number[];
  version: string;
  updatedAt: string;
  sourceId?: string;
  governance?: {
    officialSourceLabel: string;
    officialSourceUrl?: string;
    officialReference?: string;
    verifiedAt: string;
    governanceState: "official_verified" | "official_reference";
  };
};

const FORMS: MockForm[] = [
  {
    id: "f_retirement",
    code: "ت2",
    title_ar: "نموذج طلب معاش تقاعدي",
    description_ar: "طلب معاش وتعويض عائلي",
    category: "retiree_declaration",
    authority: "دائرة التقاعد - وزارة الدفاع الوطني",
    fields: [],
    related_tx: [8],
    version: "2024-01",
    updatedAt: "2024-01-15",
    governance: {
      officialSourceLabel: "دائرة التقاعد - وزارة الدفاع الوطني",
      officialReference: "نموذج تقاعدي اختباري",
      verifiedAt: "2026-05-20",
      governanceState: "official_verified",
    },
  },
  {
    id: "f_grant",
    code: "ت22",
    title_ar: "نموذج منحة مدرسية",
    description_ar: "طلب منحة تعليمية",
    category: "schooling_aid",
    authority: "تعاونية موظفي الدولة",
    fields: [],
    related_tx: [53],
    version: "2024-01",
    updatedAt: "2024-01-15",
  },
  {
    id: "f_medical",
    code: "طب-1",
    title_ar: "طلب موافقة استشفاء",
    description_ar: "طلب موافقة استشفاء للمستفيدين من الطبابة العسكرية",
    category: "medical_hospitalization",
    authority: "الطبابة العسكرية - قيادة الجيش",
    fields: [],
    related_tx: [],
    version: "2024-01",
    updatedAt: "2024-01-15",
  },
  {
    id: "f_unknown",
    code: "X1",
    title_ar: "نموذج عام",
    description_ar: "نموذج غير مصنف",
    category: "misc",
    authority: "جهة غير محددة",
    fields: [],
    related_tx: [],
    version: "2024-01",
    updatedAt: "2024-01-15",
  },
];

const app = Fastify();

async function createIntegrationApp() {
  const integrationApp = Fastify();
  await integrationApp.register(formsInlineRoutes, {
    getFormsCatalog: () => getFormsCatalog(),
    getFormById: (id: string) => getFormsCatalog().find((form) => form.id === id) || null,
    searchForms: (q: string) => getFormsCatalog().filter((form) => form.title_ar.includes(q)),
    detectFormIntent: () => [],
    isGenericFormRequest: () => false,
  });
  await integrationApp.ready();
  return integrationApp;
}

beforeAll(async () => {
  await app.register(formsInlineRoutes, {
    getFormsCatalog: () => FORMS,
    getFormById: (id: string) => FORMS.find((item) => item.id === id) || null,
    searchForms: (q: string) => FORMS.filter((item) => item.title_ar.includes(q)),
    detectFormIntent: () => [],
    isGenericFormRequest: () => false,
  });
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("forms library API", () => {
  it("serves server-side viewer shell for safe targets", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/forms/viewer?url=https%3A%2F%2Fexample.org%2Fsample.pdf&title=%D9%85%D8%B9%D8%A7%D9%8A%D9%86%D8%A9",
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"] || "").toContain("text/html");
    const html = res.body;
    expect(html).toContain("<iframe");
    expect(html).toContain("https://example.org/sample.pdf");
  });

  it("returns grouped sources including unknown forms under other", async () => {
    const res = await app.inject({ method: "GET", url: "/api/forms/sources" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { items: Array<{ sourceId: string; formCount: number }> };
    expect(body.items.some((item) => item.sourceId === "medical")).toBe(true);
    expect(body.items.some((item) => item.sourceId === "other")).toBe(true);
    expect(body.items.reduce((sum, item) => sum + item.formCount, 0)).toBeGreaterThanOrEqual(4);
  });

  it("filters by source and supports arabizi query matching", async () => {
    const res = await app.inject({ method: "GET", url: "/api/forms?sourceId=retirement&q=ta3wid" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as { items: Array<{ id: string; sourceId: string }> };
    expect(body.items.length).toBe(1);
    expect(body.items[0]).toMatchObject({ id: "f_retirement", sourceId: "retirement" });
  });

  it("returns single form with dedicated preview/download/share URLs", async () => {
    const res = await app.inject({ method: "GET", url: "/api/forms/f_retirement" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      previewUrl: string;
      downloadUrl: string;
      shareUrl: string;
      sourceName: string;
      sourceId: string;
      governance?: {
        officialSourceLabel?: string;
        verifiedAt?: string;
      };
    };

    expect(body.sourceId).toBe("retirement");
    expect(body.sourceName).toBeTruthy();
    expect(body.previewUrl).toBe("/api/forms/f_retirement/preview");
    expect(body.downloadUrl).toBe("/api/forms/f_retirement/download");
    expect(body.shareUrl).toContain("/forms/retirement");
    expect(body.governance?.officialSourceLabel).toBe("دائرة التقاعد - وزارة الدفاع الوطني");
    expect(body.governance?.verifiedAt).toBe("2026-05-20");
  });

  it("includes procedure-attached form documents in the forms inventory", async () => {
    const integrationApp = await createIntegrationApp();

    const res = await integrationApp.inject({ method: "GET", url: "/api/forms" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ id: string; origin?: string }>; total: number };
    expect(body.total).toBeGreaterThan(6);
    expect(body.items.some((item) => item.id.startsWith("DOC-WATANY_LAF_HTML"))).toBe(true);
    expect(body.items.some((item) => item.origin === "procedure_doc")).toBe(true);

    await integrationApp.close();
  });

  it("returns governed live catalog coverage, metadata, and actions", async () => {
    const integrationApp = await createIntegrationApp();

    const res = await integrationApp.inject({ method: "GET", url: "/api/forms" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      items: Array<{
        id: string;
        sourceId: string;
        origin?: string;
        previewUrl: string;
        downloadUrl: string;
        shareUrl: string;
        governance?: {
          officialSourceLabel?: string;
          officialReference?: string;
          officialSourceUrl?: string;
          verifiedAt?: string;
          governanceState?: string;
          reviewStatus?: string;
          lastReviewedAt?: string;
          authorityLabel?: string;
          reviewOwner?: string;
          confidence?: string;
        };
      }>;
    };

    const liveItems = body.items.filter((item) => item.origin === "forms_catalog");
    expect(liveItems.length).toBeGreaterThanOrEqual(11);
    expect([...new Set(liveItems.map((item) => item.sourceId))]).toEqual(
      expect.arrayContaining(["retirement", "grant", "medical", "laf", "admin"])
    );

    for (const item of liveItems) {
      expect(item.previewUrl).toBeTruthy();
      expect(item.downloadUrl).toBeTruthy();
      expect(item.shareUrl).toBeTruthy();
      expect(item.governance?.officialSourceLabel).toBeTruthy();
      expect(item.governance?.verifiedAt).toBeTruthy();
      expect(item.governance?.reviewStatus).toBeTruthy();
      expect(item.governance?.lastReviewedAt).toBeTruthy();
      expect(item.governance?.authorityLabel).toBeTruthy();
      expect(item.governance?.reviewOwner).toBeTruthy();
      expect(item.governance?.confidence).toBeTruthy();
      expect(Boolean(item.governance?.officialReference || item.governance?.officialSourceUrl)).toBe(true);
    }

    await integrationApp.close();
  });

  it("returns a governance summary for reviewer visibility", async () => {
    const integrationApp = await createIntegrationApp();

    const res = await integrationApp.inject({ method: "GET", url: "/api/forms/governance-summary" });
    expect(res.statusCode).toBe(200);

    const body = res.json() as {
      totalForms: number;
      requiredSources: string[];
      missingSourceCoverage: string[];
      reviewStatusCounts: Record<string, number>;
      sourceRegistry: Array<{ sourceId: string; formCount: number }>;
      nonApprovedRecords: Array<{ id: string; reviewStatus: string }>;
      approvedWithoutEvidence: Array<{ id: string }>;
      hasBlockingIssues: boolean;
    };

    expect(body.totalForms).toBeGreaterThanOrEqual(11);
    expect(body.requiredSources).toEqual(expect.arrayContaining(["retirement", "grant", "medical", "laf", "admin"]));
    expect(body.missingSourceCoverage).toEqual([]);
    expect(body.reviewStatusCounts.approved).toBeGreaterThan(0);
    expect(body.reviewStatusCounts.under_review).toBeGreaterThan(0);
    expect(body.sourceRegistry.map((item) => item.sourceId)).toEqual(
      expect.arrayContaining(["retirement", "grant", "medical", "laf", "admin"])
    );
    expect(body.nonApprovedRecords.some((item) => item.id === "form_service_attestation" && item.reviewStatus === "under_review")).toBe(true);
    expect(body.approvedWithoutEvidence).toEqual([]);
    expect(body.hasBlockingIssues).toBe(false);

    await integrationApp.close();
  });

  it("exposes governed live sources including medical and admin", async () => {
    const integrationApp = await createIntegrationApp();

    const res = await integrationApp.inject({ method: "GET", url: "/api/forms/sources" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ sourceId: string; formCount: number }> };

    const medicalSource = body.items.find((item) => item.sourceId === "medical");
    expect(medicalSource).toBeTruthy();
    expect(medicalSource?.formCount).toBeGreaterThan(0);
    expect(body.items.map((item) => item.sourceId)).toEqual(
      expect.arrayContaining(["retirement", "grant", "medical", "laf", "admin"])
    );

    await integrationApp.close();
  });
});
