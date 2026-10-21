import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("article analytics migration", () => {
  it("defines the canonical PostgreSQL analytics relation and lookup index", () => {
    const sql = readFileSync("src/db/migrations/054_article_analytics_events.sql", "utf8");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS watany_analytics_events");
    expect(sql).toContain("event_type VARCHAR(50) NOT NULL");
    expect(sql).toContain("event_data JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(sql).toContain("idx_article_analytics_lookup");
    expect(sql).toContain("event_data->>'articleId'");
  });
});
