import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newsRoutes } from "../routes/news";
import { FACTCHECK_FALLBACK_CAPTURED_AT } from "../routes/factcheck-fallback";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("fake-news official snapshot fallback", () => {
  it("serves the official snapshot when Fact Check Lebanon returns 403", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("blocked", { status: 403 }));
    const app = Fastify({ logger: false });
    await app.register(newsRoutes);

    const response = await app.inject({ method: "GET", url: "/api/fake-news?limit=3" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-watany-factcheck-source"]).toBe("official-snapshot");
    expect(response.headers["x-watany-factcheck-captured-at"]).toBe(FACTCHECK_FALLBACK_CAPTURED_AT);
    expect(response.headers["x-watany-factcheck-degraded"]).toBe("upstream_fetch_failed");

    const body = response.json() as Array<{ id: string; status: string; source_name: string }>;
    expect(body).toHaveLength(3);
    expect(body[0]?.id).toBe("factcheck:snapshot:234");
    expect(body.every((item) => item.status === "زائف")).toBe(true);
    expect(body.every((item) => item.source_name === "Fact Check Lebanon")).toBe(true);
    await app.close();
  });

  it("serves the official snapshot when the upstream parser yields zero items", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("<html><body></body></html>", {
      status: 200,
      headers: { "content-type": "text/html" },
    }));
    const app = Fastify({ logger: false });
    await app.register(newsRoutes);

    const response = await app.inject({ method: "GET", url: "/api/fake-news?limit=2" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-watany-factcheck-source"]).toBe("official-snapshot");
    expect(response.headers["x-watany-factcheck-degraded"]).toBe("upstream_empty");

    const body = response.json() as Array<{ id: string }>;
    expect(body.map((item) => item.id)).toEqual([
      "factcheck:snapshot:234",
      "factcheck:snapshot:233",
    ]);
    await app.close();
  });
});
