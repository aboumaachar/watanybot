import { beforeEach, describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({
  query: vi.fn(),
  getAiChat: vi.fn(),
  getAiProvider: vi.fn(() => "proof-provider"),
  getAiModel: vi.fn(() => "proof-model"),
}));

vi.mock("../../lib/db.js", () => ({ query: harness.query }));
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
  payload: { excerpt: "دليل حقوق العسكريين والمساعدات المتاحة" },
};

describe("Article SEO agent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    harness.query.mockResolvedValue({ rows: [candidate], rowCount: 1 });
    harness.getAiChat.mockReturnValue(null);
  });  it("produces a bounded heuristic proposal when AI is unavailable", async () => {
    const proposal = await analyzeArticleSeo({
      id: "article-current",
      title: "حقوق العسكريين والمساعدات",
      slug: "military-benefits",
      bodyHtml: "<p>شرح حقوق العسكريين وآلية طلب المساعدات.</p>",
      categories: ["حقوق"],
      tags: ["مساعدات"],
    });

    expect(proposal.mode).toBe("heuristic");
    expect(proposal.fields.seoTitle.length).toBeLessThanOrEqual(60);
    expect(proposal.fields.seoDescription.length).toBeLessThanOrEqual(160);
    expect(proposal.fields.canonicalUrl).toBe("https://koudama.com/articles/military-benefits");
    expect(proposal.fields.robots).toBe("index,follow");
    expect(proposal.scoreAfter).toBeGreaterThanOrEqual(proposal.scoreBefore);
    expect(proposal.internalLinks[0]?.url).toBe("/articles/related-benefits");
  });

  it("normalizes AI output and rejects invented internal URLs", async () => {
    harness.getAiChat.mockReturnValue({
      complete: vi.fn().mockResolvedValue(JSON.stringify({
        fields: {
          seoTitle: "عنوان محسّن لحقوق العسكريين والمساعدات المتاحة الآن مع نص طويل جداً يجب قصه آلياً",
          seoDescription: "وصف واضح يشرح حقوق العسكريين والمساعدات وإجراءات التقديم بدون حشو أو وعود غير موجودة.",
          focusKeyphrase: "حقوق العسكريين والمساعدات",
          canonicalUrl: "https://koudama.com/articles/military-benefits",
          robots: "index,follow",
          ogTitle: "حقوق العسكريين والمساعدات",
          ogDescription: "تعرف إلى الحقوق والمساعدات وإجراءات التقديم.",
          excerpt: "دليل مختصر حول الحقوق والمساعدات.",
        },
        internalLinks: [
          { url: "/articles/related-benefits", anchor: "دليل المساعدات", reason: "مرتبط بالموضوع" },
          { url: "https://evil.example/fake", anchor: "رابط خارجي", reason: "غير مسموح" },
        ],
      })),
    });    const proposal = await analyzeArticleSeo({
      id: "article-current",
      title: "حقوق العسكريين والمساعدات",
      slug: "military-benefits",
      bodyHtml: "<p>شرح حقوق العسكريين وآلية طلب المساعدات.</p>",
      featuredImage: "/media/archive/proof.jpg",
    });

    expect(proposal.mode).toBe("ai");
    expect(proposal.provider).toBe("proof-provider");
    expect(proposal.model).toBe("proof-model");
    expect(proposal.fields.seoTitle.length).toBeLessThanOrEqual(60);
    expect(proposal.fields.seoDescription.length).toBeLessThanOrEqual(160);
    expect(proposal.internalLinks).toHaveLength(1);
    expect(proposal.internalLinks[0]?.url).toBe("/articles/related-benefits");
    expect(proposal.internalLinks.some((item) => item.url.includes("evil.example"))).toBe(false);
  });
});
