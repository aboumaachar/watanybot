import { describe, expect, it } from "vitest";

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret";

const { default: app } = await import("../server");

describe("Gateway procedures search regressions", () => {
  it.each([
    "بطاقة الخدمات الصحية",
    "بطاقة صحية",
    "بطاقة الطبابة",
  ])("prioritizes veteran-facing medical content for %s", async (query) => {
    const response = await app.inject({
      method: "GET",
      url: `/api/v2/procedures/search?q=${encodeURIComponent(query)}&limit=3`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload || "{}");
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items[0]?.content_tier).not.toBe("archive");
    expect(["institutional_admin", "public_general"]).not.toContain(body.items[0]?.audience_scope);
  });

  it("does not return a loose numeric match for transaction_76", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/search?q=transaction_76&limit=3",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload || "{}");
    expect(body.items).toEqual([]);
  });

  it("hides archive-tier procedures from the default catalog", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/catalog",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload || "{}");
    const items = (body.sections || []).flatMap((section: { items?: Array<{ content_tier?: string }> }) => section.items || []);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((item: { content_tier?: string }) => item.content_tier !== "archive")).toBe(true);
  });

  it("returns archive-tier administrative procedures when explicitly requested", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v2/procedures/search?q=%D8%A7%D9%84%D8%A7%D8%B1%D8%AA%D9%81%D8%A7%D9%82%20%D8%A7%D9%84%D8%AC%D9%88%D9%8A&limit=5",
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.payload || "{}");
    expect(body.items.length).toBeGreaterThan(0);
    expect(
      body.items.some(
        (item: { audience_scope?: string; content_tier?: string; title_ar?: string }) =>
          ["archive", "supporting"].includes(item.content_tier || "")
          && ["institutional_admin", "public_general"].includes(item.audience_scope || "")
          && Boolean(item.title_ar?.includes("الجوي") || item.title_ar?.includes("الجيش")),
      ),
    ).toBe(true);
  });
});