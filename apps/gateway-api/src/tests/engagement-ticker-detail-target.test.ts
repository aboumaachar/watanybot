import { beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.hoisted(() => vi.fn());
vi.mock("../lib/db.js", () => ({ query: queryMock }));

import { getLatestEngagementHighlights } from "../routes/engagement.js";

const pluginDb = {
  prepare() {
    return { all: () => [] };
  },
} as any;

describe("ticker latest activity detail targets", () => {
  beforeEach(() => {
    queryMock.mockReset();
  });

  it("targets the exact published article rather than the article landing page", async () => {
    queryMock.mockResolvedValue({
      rows: [{
        domain: "articles",
        public_id: "article-uuid-1",
        public_code: "article-public-code",
        title: "Exact article title",
        payload: {},
        created_at: "2026-10-03T12:00:00.000Z",
        updated_at: "2026-10-03T12:00:00.000Z",
        published_at: "2026-10-03T12:00:00.000Z",
      }],
    });

    const highlights = await getLatestEngagementHighlights(pluginDb);
    const article = highlights.find((item) => item.title === "Exact article title");
    expect(article).toBeDefined();
    expect(article?.href).toBe("/articles/article-public-code");
    expect(article?.href).not.toBe("/articles");
  });

  it("falls back to the stable public id when public code is absent", async () => {
    queryMock.mockResolvedValue({
      rows: [{
        domain: "articles",
        public_id: "article uuid 2",
        public_code: null,
        title: "Fallback article",
        payload: {},
        created_at: "2026-10-03T12:00:00.000Z",
        updated_at: "2026-10-03T12:00:00.000Z",
        published_at: "2026-10-03T12:00:00.000Z",
      }],
    });

    const highlights = await getLatestEngagementHighlights(pluginDb);
    const article = highlights.find((item) => item.title === "Fallback article");
    expect(article?.href).toBe("/articles/article%20uuid%202");
  });
});
