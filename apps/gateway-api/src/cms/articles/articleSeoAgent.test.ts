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

import { analyzeArticleSeo } from "./articleSeoAgent.js";

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
});
