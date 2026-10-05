/**
 * Retirement smoke tests for the legacy /api/v2/* compatibility surface.
 *
 * Production authority is Node-first with USE_PYTHON_API=false. Supported
 * compatibility routes remain available without Python; the non-equivalent
 * generic v2 salary engine is explicitly retired with HTTP 410.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../server";

beforeAll(async () => {
  expect(process.env.USE_PYTHON_API).toBe("false");
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

describe("POST /api/v2/chat — Node compatibility", () => {
  it("rejects a missing question", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v2/chat", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });

  it("uses the Node chat authority when Python is retired", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/chat",
      payload: { question: "مرحبا", lang: "ar" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(res.json()).toHaveProperty("answer_lb");
  });
});

describe("GET /api/v2/search — Node compatibility", () => {
  it("returns the local search contract", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/search?q=تقاعد" });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    const body = res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("query", "تقاعد");
  });

  it("rejects an empty query locally", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/search?q=" });
    expect(res.statusCode).toBe(422);
  });
});

describe("POST /api/v2/intent — Node compatibility", () => {
  it("returns the parity-backed local legacy intent contract", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/intent",
      payload: { text: "بدي اعرف قديش معاشي" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(res.json()).toMatchObject({ intent: "salary_compute", domain: "salary" });
  });
});

describe("POST /api/v2/salary/compute — retired generic model", () => {
  it("returns explicit 410 instead of silently mapping to the permanent Node salary model", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/salary/compute",
      payload: { rank: "جندي", degree: 1, married: false, kids: 0 },
    });
    expect(res.statusCode).toBe(410);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("retired");
    expect(res.json()).toMatchObject({
      code: "LEGACY_V2_SALARY_RETIRED",
      retired: true,
      current_salary_route: "/api/salary/calc",
      semantic_equivalence: false,
    });
  });
});

describe("/api/v2/tickets — local PostgreSQL authority", () => {
  it("requires authentication for create when Python is retired", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/tickets",
      payload: { title_lb: "استفسار عن المعاش", description: "أحتاج مساعدة" },
    });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Authentication required" });
  });

  it("requires authentication for list when Python is retired", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/tickets" });
    expect(res.statusCode).toBe(401);
    expect(res.json()).toMatchObject({ error: "Authentication required" });
  });
});

describe("GET /api/v2/diagnostics — local diagnostics", () => {
  it("reports local readiness without depending on Python", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/diagnostics" });
    expect([200, 502]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
      expect(res.json()).toMatchObject({ ready: true, source: "node-fallback", python_backend: "unavailable" });
    } else {
      expect(res.json()).toMatchObject({ error: "KB v2 backend unavailable" });
    }
  });
});

describe("POST /api/v2/feedback — Node-owned", () => {
  it("returns 400 when interactionId is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/feedback",
      payload: { message: "سؤال غير واضح", rating: 2, lang: "ar" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns success when interactionId is supplied", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/feedback",
      payload: { interactionId: "test-interaction-001", helpful: true, rating: 4, comment: "جيد" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ success: true });
  });
});
