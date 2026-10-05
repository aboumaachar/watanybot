import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("undici", () => ({
  request: vi.fn(async () => {
    throw new Error("LEGACY_PYTHON_REQUEST_MUST_NOT_EXECUTE");
  }),
}));

import { request as undiciRequest } from "undici";
import { kbV2ProxyRoutes } from "../routes/kb-v2-proxy";

const getPythonBase = () => "http://127.0.0.1:8010";

async function buildRetiredApp() {
  const app = Fastify({ logger: false });
  app.post("/api/chat", async () => ({
    reply: "مرحبا فيك",
    debug: { chitchat: true },
    sources: [],
    intents: ["greeting"],
    menu: [],
  }));
  app.get("/api/legal/content", async () => ({ items: [] }));
  app.get("/api/v2/procedures/search", async () => ({ items: [] }));
  app.get("/api/kb/live-search", async () => ({ documents: [] }));
  app.get("/api/health", async () => ({ status: "ok" }));
  app.get("/api/kb/stats", async () => ({ ok: true, ragChunks: 10 }));
  app.get("/api/kb-nodes/stats", async () => ({ ready: true, total: 10 }));
  await app.register(kbV2ProxyRoutes, { getPythonBase, usePython: false });
  await app.ready();
  return app;
}

describe("KB v2 legacy Python retirement", () => {
  it("serves supported v2 compatibility routes without any Python request", async () => {
    const requestMock = vi.mocked(undiciRequest);
    requestMock.mockClear();
    const app = await buildRetiredApp();

    const chat = await app.inject({ method: "POST", url: "/api/v2/chat", payload: { question: "مرحبا", lang: "ar" } });
    expect(chat.statusCode).toBe(200);
    expect(chat.headers["x-watany-kb-v2-source"]).toBe("node-fallback");

    const search = await app.inject({ method: "GET", url: "/api/v2/search?q=تقاعد" });
    expect(search.statusCode).toBe(200);
    expect(search.headers["x-watany-kb-v2-source"]).toBe("node-fallback");

    const intent = await app.inject({ method: "POST", url: "/api/v2/intent", payload: { text: "بدي اعرف قديش معاشي" } });
    expect(intent.statusCode).toBe(200);
    expect(intent.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(intent.json()).toMatchObject({ intent: "salary_compute", domain: "salary" });

    const diagnostics = await app.inject({ method: "GET", url: "/api/v2/diagnostics" });
    expect(diagnostics.statusCode).toBe(200);
    expect(diagnostics.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(diagnostics.json()).toMatchObject({ ready: true, source: "node-fallback" });

    expect(requestMock).not.toHaveBeenCalled();
    await app.close();
  });

  it("retires the non-equivalent generic v2 salary engine explicitly without upstream traffic", async () => {
    const requestMock = vi.mocked(undiciRequest);
    requestMock.mockClear();
    const app = await buildRetiredApp();

    const salary = await app.inject({
      method: "POST",
      url: "/api/v2/salary/compute",
      payload: { rank: "جندي", degree: "1", category: "عسكري", service_years: 20 },
    });

    expect(salary.statusCode).toBe(410);
    expect(salary.headers["x-watany-kb-v2-source"]).toBe("retired");
    expect(salary.json()).toEqual({
      error: "Legacy KB v2 salary engine retired",
      code: "LEGACY_V2_SALARY_RETIRED",
      retired: true,
      current_salary_route: "/api/salary/calc",
      semantic_equivalence: false,
    });
    expect(requestMock).not.toHaveBeenCalled();
    await app.close();
  });
});
