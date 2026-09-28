import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  query: vi.fn(),
  stat: vi.fn(),
  resolveArticleMediaPath: vi.fn(),
  getAiChat: vi.fn(),
  getAiProvider: vi.fn(() => "proof-provider"),
  getAiModel: vi.fn(() => "proof-model"),
}));

vi.mock("../../lib/db.js", () => ({ query: harness.query }));
vi.mock("node:fs/promises", () => ({ stat: harness.stat }));
vi.mock("./articleMediaStorage.js", () => ({ resolveArticleMediaPath: harness.resolveArticleMediaPath }));
vi.mock("../../bootstrap/ai-state.js", () => ({
  getAiChat: harness.getAiChat,
  getAiProvider: harness.getAiProvider,
  getAiModel: harness.getAiModel,
}));

import { analyzeArticleSeo, auditPublishedArticlesSeo, buildArticleSeoSafeFixes } from "./articleSeoAgent.js";

const candidate = {
  public_id: "article-related",
  public_code: "related-benefits",
  title: "حقوق العسكريين والتقديم على المساعدات",
  status: "PUBLISHED",
  payload: { primaryCategory: "حقوق", permalinkSlug: "related-benefits", excerpt: "دليل حقوق العسكريين والمساعدات المتاحة" },
};
describe("Article SEO agent V3", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.query.mockResolvedValue({ rows: [candidate], rowCount: 1 });
    harness.getAiChat.mockReturnValue(null);
    harness.resolveArticleMediaPath.mockReturnValue(null);
    harness.stat.mockResolvedValue({ isFile: () => true });
  });

  it("produces canonical clean URLs and deterministic audit data without AI", async () => {
    const proposal = await analyzeArticleSeo({
      id: "article-current",
      status: "DRAFT",
      title: "حقوق العسكريين والمساعدات",
      slug: "military-benefits",
      permalinkSlug: "military-benefits",
      primaryCategory: "حقوق",
      bodyHtml: "<h2>الحقوق</h2><p>شرح حقوق العسكريين وآلية طلب المساعدات.</p>",
      categories: ["حقوق"],
      tags: ["مساعدات"],
    });

    expect(proposal.mode).toBe("heuristic");
    expect(proposal.fields.seoTitle.length).toBeLessThanOrEqual(60);
    expect(proposal.fields.seoDescription.length).toBeLessThanOrEqual(160);
    expect(proposal.fields.canonicalUrl).toBe("https://koudama.com/articles/hqwq/military-benefits");
    expect(proposal.fields.robots).toBe("index,follow");
    expect(proposal.internalLinks[0]?.url).toBe("/articles/hqwq/related-benefits");
    expect(proposal.audit.indexing.sitemapIncluded).toBe(false);
  });

  it("detects canonical drift, heading gaps, missing alt text and broken internal links", async () => {
    const proposal = await analyzeArticleSeo({
      id: "article-current",
      status: "PUBLISHED",
      title: "حقوق العسكريين والتقديم على المساعدات",
      slug: "current",
      permalinkSlug: "current-rights",
      primaryCategory: "حقوق",
      seoTitle: "حقوق العسكريين والتقديم على المساعدات",
      seoDescription: "شرح مفصل لحقوق العسكريين وآلية التقديم على المساعدات والخدمات المتاحة وخطوات الاستفادة منها بصورة واضحة.",
      canonicalUrl: "https://koudama.com/articles/wrong/path",
      robots: "index,follow",
      bodyHtml: '<h2>الحقوق</h2><h4>التقديم</h4><img src="/x.jpg" alt=""><a href="/articles/missing/article">مفقود</a>',
      categories: ["حقوق"],
    });

    expect(proposal.audit.score).toBeLessThan(100);
    expect(proposal.audit.indexing.canonicalMatches).toBe(false);
    expect(proposal.audit.heading.skippedLevels).toBe(1);
    expect(proposal.audit.images.missingAlt).toBe(1);
    expect(proposal.audit.links.brokenInternal).toContain("/articles/missing/article");
    expect(proposal.audit.duplicateCandidates.length).toBeGreaterThan(0);
    expect(proposal.issues.some((issue) => issue.includes("Canonical"))).toBe(true);
  });

  it("normalizes AI output and only accepts canonical internal-link candidates", async () => {
    harness.getAiChat.mockReturnValue({
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        fields: {
          seoTitle: "عنوان محسّن لحقوق العسكريين والمساعدات المتاحة الآن مع نص طويل جداً يجب قصه آلياً",
          seoDescription: "وصف واضح يشرح حقوق العسكريين والمساعدات وإجراءات التقديم بدون حشو أو وعود غير موجودة.",
          focusKeyphrase: "حقوق العسكريين والمساعدات",
          canonicalUrl: "https://evil.example/canonical",
          robots: "index,follow",
          ogTitle: "حقوق العسكريين والمساعدات",
          ogDescription: "تعرف إلى الحقوق والمساعدات وإجراءات التقديم.",
          excerpt: "دليل مختصر حول الحقوق والمساعدات.",
        },
        internalLinks: [
          { url: "/articles/hqwq/related-benefits", anchor: "دليل المساعدات", reason: "مرتبط بالموضوع" },
          { url: "https://evil.example/fake", anchor: "رابط خارجي", reason: "غير مسموح" },
        ],
      })),
    });

    const proposal = await analyzeArticleSeo({
      id: "article-current",
      title: "حقوق العسكريين والمساعدات",
      slug: "military-benefits",
      permalinkSlug: "military-benefits",
      primaryCategory: "حقوق",
      bodyHtml: "<h2>الحقوق</h2><p>شرح حقوق العسكريين وآلية طلب المساعدات.</p>",
      featuredImage: "/media/archive/proof.jpg",
    });

    expect(proposal.mode).toBe("ai");
    expect(proposal.provider).toBe("proof-provider");
    expect(proposal.model).toBe("proof-model");
    expect(proposal.fields.seoTitle.length).toBeLessThanOrEqual(60);
    expect(proposal.fields.seoDescription.length).toBeLessThanOrEqual(160);
    expect(proposal.fields.canonicalUrl).toBe("https://koudama.com/articles/hqwq/military-benefits");
    expect(proposal.internalLinks).toHaveLength(1);
    expect(proposal.internalLinks[0]?.url).toBe("/articles/hqwq/related-benefits");
    expect(proposal.internalLinks.some((item) => item.url.includes("evil.example"))).toBe(false);
    expect(proposal.audit.checks.length).toBeGreaterThan(5);
  });

  it("applies deterministic safe fixes and can reach a perfect audit when no unsafe issues remain", async () => {
    harness.query.mockResolvedValue({ rows: [], rowCount: 0 });
    const fix = await buildArticleSeoSafeFixes({
      id: "article-current",
      status: "PUBLISHED",
      title: "مشروع موازنة العام 2027 وخطة التصحيح المستدام",
      slug: "budget-2027",
      permalinkSlug: "budget-2027",
      primaryCategory: "قوانين",
      categories: ["قوانين"],
      seoTitle: "مشروع موازنة 2027 وخطة التصحيح المستدام للرواتب",
      seoDescription: "دراسة قانونية تشرح مشروع موازنة 2027 وخطة التصحيح المستدام للرواتب والأجور والمعاشات التقاعدية ومسار حماية الحقوق.",
      canonicalUrl: "https://koudama.com/articles/legacy/wrong",
      robots: "index,follow",
      bodyHtml: "<h1>مقدمة</h1><p>شرح مفصل لمشروع الموازنة وخطة التصحيح.</p>",
    });

    expect(fix.patch.canonicalUrl).toBe("https://koudama.com/articles/qwanyn/budget-2027");
    expect(fix.patch.bodyHtml).not.toContain("<h1");
    expect(fix.patch.bodyHtml).toContain("<h2>مقدمة</h2>");
    expect(fix.patch.ogImage).toContain("/logo.png");
    expect(fix.scoreAfter).toBe(100);
    expect(fix.audit.indexing.canonicalMatches).toBe(true);
  });

  it("builds a bulk SEO health report with internal 30-day performance counters", async () => {
    const rows = [
      { public_id: "a1", public_code: "one", title: "مقال أول عن الموازنة", status: "PUBLISHED", payload: { primaryCategory: "قوانين", categories: ["قوانين"], permalinkSlug: "one", seoTitle: "مقال أول عن الموازنة العامة 2027", seoDescription: "وصف تفصيلي مناسب للمقال الأول عن الموازنة العامة وخطة الإصلاح المالي والاجتماعي وحماية الحقوق بصورة واضحة.", canonicalUrl: "https://koudama.com/articles/qwanyn/one", robots: "index,follow", bodyHtml: "<h2>التفاصيل</h2><p>محتوى المقال الأول.</p>" } },
      { public_id: "a2", public_code: "two", title: "مقال ثان عن التعليم", status: "PUBLISHED", payload: { primaryCategory: "تربية", categories: ["تربية"], permalinkSlug: "two", seoTitle: "مقال ثان عن التعليم والمنح المدرسية", seoDescription: "وصف تفصيلي مناسب للمقال الثاني عن التعليم والمنح المدرسية وآلية الاستفادة من الحقوق التعليمية المتاحة للأسر.", canonicalUrl: "https://koudama.com/articles/trbya/two", robots: "index,follow", bodyHtml: "<h2>التعليم</h2><p>محتوى المقال الثاني.</p>" } },
    ];
    harness.query.mockImplementation(async (sql: string) => sql.includes("watany_analytics_events")
      ? { rows: [{ article_id: "a1", event_type: "article_view", count: 7 }, { article_id: "a1", event_type: "article_share", count: 2 }, { article_id: "a2", event_type: "article_pdf_download", count: 3 }], rowCount: 3 }
      : { rows, rowCount: rows.length });

    const report = await auditPublishedArticlesSeo(50);
    expect(report.summary.total).toBe(2);
    expect(report.summary.performance.views30d).toBe(7);
    expect(report.summary.performance.shares30d).toBe(2);
    expect(report.summary.performance.pdfDownloads30d).toBe(3);
    expect(report.items.find((item) => item.id === "a1")?.performance.views30d).toBe(7);
    expect(report.items.every((item) => item.url.startsWith("/articles/"))).toBe(true);
  });
});
