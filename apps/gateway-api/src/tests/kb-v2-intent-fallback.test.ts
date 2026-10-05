import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { kbV2ProxyRoutes } from "../routes/kb-v2-proxy";

const pythonDown = () => "http://127.0.0.1:1";

describe("KB v2 intent Node fallback", () => {
  it("returns the canonical legacy intent result when Python is unavailable", async () => {
    const app = Fastify({ logger: false });
    await app.register(kbV2ProxyRoutes, { getPythonBase: pythonDown });
    await app.ready();

    const res = await app.inject({
      method: "POST",
      url: "/api/v2/intent",
      payload: { text: "بدي اعرف قديش معاشي" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(res.json()).toMatchObject({
      intent: "salary_compute",
      domain: "salary",
      request_type: "salary",
      urgency: "normal",
      slots_missing: ["rank", "degree", "category"],
      confidence: 0.5,
    });

    await app.close();
  });

  it("rejects a missing text payload before attempting either backend", async () => {
    const app = Fastify({ logger: false });
    await app.register(kbV2ProxyRoutes, { getPythonBase: pythonDown });
    await app.ready();

    const res = await app.inject({ method: "POST", url: "/api/v2/intent", payload: {} });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "text required" });

    await app.close();
  });
});
