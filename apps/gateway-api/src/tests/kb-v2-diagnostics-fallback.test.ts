import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { kbV2ProxyRoutes } from "../routes/kb-v2-proxy";

describe("KB v2 diagnostics degraded fallback", () => {
  it("returns local health instead of 502 when Python is unavailable", async () => {
    const app = Fastify({ logger: false });
    app.get("/api/health", async () => ({ status: "ok" }));
    app.get("/api/kb/stats", async () => ({ ok: true, ragChunks: 10 }));
    app.get("/api/kb-nodes/stats", async () => ({ ready: true, total: 10 }));
    await app.register(kbV2ProxyRoutes, { getPythonBase: () => "http://127.0.0.1:1" });
    await app.ready();

    const response = await app.inject({ method: "GET", url: "/api/v2/diagnostics" });
    expect(response.statusCode).toBe(200);
    expect(response.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(response.json()).toMatchObject({
      status: "degraded",
      ready: true,
      source: "node-fallback",
      python_backend: "unavailable",
    });
    await app.close();
  });
});
