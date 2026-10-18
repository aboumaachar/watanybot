import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { unifiedSearchRoutes } from "../routes/unified-search";

describe("unified search child response compatibility", () => {
  it("keeps KB nodes and v2 items instead of dropping them", async () => {
    const app = Fastify({ logger: false });
    app.get("/api/kb-nodes/search", async () => ({ nodes: [{ id: "kb-1" }] }));
    app.get("/api/v2/search", async () => ({ items: [{ id: "v2-1" }] }));
    app.get("/api/tx/search", async () => ({ results: [] }));
    await app.register(unifiedSearchRoutes);
    await app.ready();

    const response = await app.inject({
      method: "GET",
      url: "/api/search/unified?q=apex-shape-regression&limit=5",
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results.kb).toEqual([{ id: "kb-1" }]);
    expect(body.results.v2).toEqual([{ id: "v2-1" }]);
    expect(body.total).toBe(2);
    await app.close();
  });
});
