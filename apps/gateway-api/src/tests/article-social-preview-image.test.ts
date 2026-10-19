/**
 * Social preview metadata for articles (production contract): crawlers always get the
 * normalized 1200x630 JPEG share card under /media/share/articles/, versioned by the
 * source image, so og:image never points at a large original. The explicit SEO image
 * (ogImage) is preferred over the featured image as the card's source.
 */
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/db.js", () => ({ query: queryMock }));

import { articleRoutes } from "../routes/articles.js";

const SHARE_CARD = /<meta property="og:image" content="(https:\/\/koudama\.com\/media\/share\/articles\/[0-9a-f]{24}-[0-9a-f]{16}\.jpg)">/;

function articleRow(payload: Record<string, unknown>) {
  return {
    public_id: "article-social-preview-test",
    public_code: "test-article",
    title: "Test article",
    payload: { categories: ["news"], primaryCategory: "news", permalinkSlug: "test-article", ...payload },
    published_at: "2026-10-05T08:00:00.000Z",
    updated_at: "2026-10-05T08:00:00.000Z",
  };
}

describe("article social preview image metadata", () => {
  let app = Fastify();

  beforeEach(async () => {
    queryMock.mockReset();
    app = Fastify();
    await app.register(articleRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  async function preview(payload: Record<string, unknown>) {
    queryMock.mockResolvedValue({ rows: [articleRow(payload)] });
    const response = await app.inject({
      method: "GET",
      url: "/api/articles/social-preview/news/test-article",
      headers: { "user-agent": "meta-externalagent/1.1" },
    });
    expect(response.statusCode).toBe(200);
    const card = SHARE_CARD.exec(response.body)?.[1];
    expect(card).toBeDefined();
    return { body: response.body, card: card as string };
  }

  it("serves the normalized 1200x630 JPEG share card with the SEO alt text", async () => {
    const { body, card } = await preview({
      featuredImage: "https://koudama.com/mcp/api/articles/media/large-featured.png",
      ogImage: "/media/social/articles/share-preview.jpg",
      ogImageAlt: "Plan infographic",
    });
    expect(body).toContain(`<meta property="og:image:secure_url" content="${card}">`);
    expect(body).toContain('<meta property="og:image:type" content="image/jpeg">');
    expect(body).toContain('<meta property="og:image:width" content="1200">');
    expect(body).toContain('<meta property="og:image:height" content="630">');
    expect(body).toContain('<meta property="og:image:alt" content="Plan infographic">');
    expect(body).toContain(`<meta name="twitter:image" content="${card}">`);
    expect(body).not.toContain("large-featured.png");
    expect(body).not.toContain("share-preview.jpg");
  });

  it("prefers the SEO image over the featured image as the card source", async () => {
    const featured = "https://koudama.com/mcp/api/articles/media/featured.png";
    const withSeo = await preview({ featuredImage: featured, ogImage: "/media/social/articles/share-preview.jpg" });
    const featuredOnly = await preview({ featuredImage: featured });
    const otherSeo = await preview({ featuredImage: featured, ogImage: "/media/social/articles/other.jpg" });
    expect(withSeo.card).not.toBe(featuredOnly.card);
    expect(withSeo.card).not.toBe(otherSeo.card);
    expect((await preview({ featuredImage: featured, ogImage: "/media/social/articles/share-preview.jpg" })).card).toBe(withSeo.card);
  });

  it("falls back to the title as alt text when no SEO image metadata exists", async () => {
    const { body } = await preview({ featuredImage: "https://koudama.com/mcp/api/articles/media/featured.png" });
    expect(body).toContain('<meta property="og:image:alt" content="Test article">');
    expect(body).toContain('<meta property="og:image:width" content="1200">');
    expect(body).toContain('<meta property="og:image:height" content="630">');
  });
});
