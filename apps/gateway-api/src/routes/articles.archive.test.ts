import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { queryMock } = vi.hoisted(() => ({ queryMock: vi.fn() }));
vi.mock("../lib/db.js", () => ({ query: queryMock }));
vi.mock("../cms/articles/articleMediaStorage.js", () => ({
  resolveArticleMediaPath: () => null,
  mimeForMediaFile: () => null,
}));

import { articleRoutes } from "./articles.js";

type Row = {
  public_id: string;
  public_code: string;
  title: string;
  published_at: string;
  updated_at: string;
  payload: { categories: string[]; primaryCategory: string; permalinkSlug: string; robots: string };
};
const records: Row[] = Array.from({ length: 192 }, (_, index) => ({
  public_id: "synthetic-" + (index + 1),
  public_code: "story-" + (index + 1),
  title: "Synthetic story " + (index + 1),
  published_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T00:00:00Z",
  payload: { categories: ["اخبار"], primaryCategory: "اخبار", permalinkSlug: "story-" + (index + 1), robots: "index,follow" },
}));

describe("article crawler archive with synthetic query data", () => {
  let app: ReturnType<typeof Fastify>;
  beforeEach(async () => {
    queryMock.mockReset();
    queryMock.mockImplementation(async (sql: string, bind: unknown[] = []) => {
      if (sql.includes("domain='article-categories'")) return { rows: [{ title: "اخبار" }] };
      if (!sql.includes("FROM cms_content_entities")) throw new Error("UNEXPECTED_SQL");
      const limit = Number(bind[bind.length - 2]);
      const offset = Number(bind[bind.length - 1]);
      return { rows: records.slice(offset, offset + limit) };
    });
    app = Fastify({ logger: false });
    await app.register(articleRoutes);
    await app.ready();
  });
  afterEach(async () => {
    await app.close();
  });

  it("serves fifty canonical article links and a real next-page anchor", async () => {
    const reply = await app.inject({ method: "GET", url: "/api/articles/search-archive" });
    expect(reply.statusCode).toBe(200);
    expect(reply.headers["content-type"]).toMatch(/text\/html/);
    expect((reply.body.match(/<li>/g) || [])).toHaveLength(50);
    expect(reply.body).toContain('href="https://koudama.com/articles/akhbar/story-1"');
    expect(reply.body).toContain('href="https://koudama.com/articles?page=2"');
    expect(reply.body).toContain('href="https://koudama.com/articles?category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1"');
    expect(reply.body).toContain('rel="canonical" href="https://koudama.com/articles"');
    expect(reply.body).toContain('content="index,follow"');
    expect(queryMock).toHaveBeenCalled();
  });

  it("makes later archive pages navigable and preserves canonical pagination", async () => {
    const reply = await app.inject({ method: "GET", url: "/api/articles/search-archive?page=4" });
    expect(reply.statusCode).toBe(200);
    expect((reply.body.match(/<li>/g) || [])).toHaveLength(42);
    expect(reply.body).toContain('href="https://koudama.com/articles?page=3"');
    expect(reply.body).not.toContain("الصفحة التالية</a>");
    expect(reply.body).toContain('rel="canonical" href="https://koudama.com/articles?page=4"');
  });

  it("keeps category context and excludes searches from indexing", async () => {
    const reply = await app.inject({method:"GET",url:"/api/articles/search-archive?category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1&q=example&page=2"});
    expect(reply.statusCode).toBe(200);
    expect(reply.body).toContain('content="noindex,follow"');
    expect(reply.body).toContain('category=%D8%A7%D8%AE%D8%A8%D8%A7%D8%B1');
    expect(reply.body).toContain("q=example");
    expect(reply.body).toContain("page=2");
    const queried = queryMock.mock.calls.find(call => String(call[0]).includes("ILIKE"));
    expect(queried).toBeTruthy();
    expect(String(queried![0])).toContain("status='PUBLISHED'");
    expect(String(queried![0])).toContain("NOT LIKE 'noindex%'");
  });
});
