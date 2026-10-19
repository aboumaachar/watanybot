/**
 * tests/proxy-routes.test.ts
 *
 * Smoke tests for all /api/v2/* proxy routes that forward to the Python backend.
 *
 * These tests verify:
 *   1. When Python is unreachable → Node returns 502 with { error: string }
 *   2. When Python is reachable   → Node returns 200 with the expected shape
 *
 * The tests are environment-aware: if PYTHON_BASE is unset or Python is down
 * in CI, all proxy tests assert the graceful-degradation 502 path.
 *
 * To run against a live Python backend:
 *   PYTHON_BASE=http://localhost:8012 pnpm test tests/proxy-routes.test.ts
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Force the gateway to treat the Python upstream as unreachable for this
// test file only, then restore after the suite completes.
import { restorePythonEnv, forcePythonDown } from "./setup/force-python-down";
import { app } from "../server";

// True when a real Python backend is configured for this test run
const PYTHON_UP = Boolean(
  process.env.PYTHON_BASE &&
  process.env.PYTHON_BASE !== "" &&
  process.env.PYTHON_UP === "1"
);

beforeAll(async () => {
  // Apply the test shim before the gateway initializes so the in-memory
  // `pythonBase` reflects the forced-down state when `app` boots.
  forcePythonDown();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try {
    restorePythonEnv();
  } catch (err) {
    // best-effort restore
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Helper
// ─────────────────────────────────────────────────────────────────────────────
function expectProxyOkOrDown(statusCode: number, body: Record<string, unknown>) {
  if (PYTHON_UP) {
    expect(statusCode).toBe(200);
  } else {
    // Graceful degradation: proxy returns 502 with a readable error
    expect(statusCode).toBe(502);
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/chat
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v2/chat (proxy → Python with Node fallback)", () => {
  it("returns 400 when question is missing", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v2/chat", payload: {} });
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty("error");
  });

  it("falls back to authoritative Node chat when Python is unavailable", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/chat",
      payload: { question: "مرحبا", lang: "ar" },
    });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(typeof body.answer_lb).toBe("string");
    expect(body.answer_lb.length).toBeGreaterThan(0);
    expect(typeof body.confidence).toBe("number");
    expect(Array.isArray(body.kb_hits)).toBe(true);
    expect(Array.isArray(body.menu)).toBe(true);
    expect(body).toHaveProperty("intent_result");
  });
});

// GET /api/v2/search
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/search (proxy → Python)", () => {
  it("returns 200 or 502 for a search query", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/search?q=تقاعد",
    });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body).toHaveProperty("total");
    expect(body).toHaveProperty("query", "تقاعد");
  });

  it("handles empty q gracefully", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/search?q=",
    });
    // Either proxy forwards and Python validates, or 502 if Python down
    expect([200, 400, 422, 502]).toContain(res.statusCode);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/intent
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v2/intent (proxy -> Python with Node fallback)", () => {
  it("falls back to the canonical legacy intent authority when Python is unavailable", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/intent",
      payload: { text: "بدي اعرف قديش معاشي" },
    });
    const body = res.json();
    expect(res.statusCode).toBe(200);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
    expect(body).toMatchObject({ intent: "salary_compute", domain: "salary", request_type: "salary" });
    expect(typeof body.confidence).toBe("number");
  });

  it("returns 422 when text is missing", async () => {
    const res = await app.inject({ method: "POST", url: "/api/v2/intent", payload: {} });
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: "text required" });
  });
});

// POST /api/v2/salary/compute
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v2/salary/compute (proxy → Python)", () => {
  it("returns 200 or 502 for a salary compute request", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/salary/compute",
      payload: { rank: "جندي", degree: 1, married: false, kids: 0 },
    });
    const body = res.json();
    expectProxyOkOrDown(res.statusCode, body);

    if (PYTHON_UP) {
      // Python SalaryComputeResponse fields (from schemas_kb_v2.py)
      expect(body).toHaveProperty("breakdown");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/tickets
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v2/tickets (proxy → Python)", () => {
  it("uses the local fallback and requires authentication when Python is unavailable", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/tickets",
      payload: { subject: "استفسار عن المعاش", message: "أحتاج مساعدة", lang: "ar" },
    });
    const body = res.json();
    expect(res.statusCode).toBe(401);
    expect(body).toMatchObject({ error: "Authentication required" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/tickets
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/tickets (proxy → Python)", () => {
  it("uses the local fallback and requires authentication when Python is unavailable", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/v2/tickets",
    });
    const body = res.json();
    expect(res.statusCode).toBe(401);
    expect(body).toMatchObject({ error: "Authentication required" });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/v2/diagnostics
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/diagnostics (proxy → Python with Node fallback)", () => {
  // The Node fallback reports "degraded" only when the local KB is actually ready; otherwise the
  // route keeps its 502 contract. Assert the branch that matches this environment's KB state.
  async function localKbReady(): Promise<boolean> {
    const [health, kb, nodes] = await Promise.all([
      app.inject({ method: "GET", url: "/api/health" }),
      app.inject({ method: "GET", url: "/api/kb/stats" }),
      app.inject({ method: "GET", url: "/api/kb-nodes/stats" }),
    ]);
    if ([health, kb, nodes].some((r) => r.statusCode < 200 || r.statusCode >= 300)) return false;
    return health.json().status === "ok" && kb.json().ok === true && nodes.json().ready === true;
  }

  it("returns upstream diagnostics, the degraded Node fallback, or 502 when nothing is ready", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/diagnostics" });
    const body = res.json();
    if (PYTHON_UP) {
      expect(res.statusCode).toBe(200);
      expect(body).toHaveProperty("status");
      expect(body).toHaveProperty("kb_path");
    } else if (await localKbReady()) {
      expect(res.statusCode).toBe(200);
      expect(res.headers["x-watany-kb-v2-source"]).toBe("node-fallback");
      expect(body).toMatchObject({ status: "degraded", ready: true, source: "node-fallback", python_backend: "unavailable" });
    } else {
      expect(res.statusCode).toBe(502);
      expect(body).toMatchObject({ error: "KB v2 backend unavailable" });
      expect(res.headers["x-watany-kb-v2-source"]).toBeUndefined();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v2/feedback
// ─────────────────────────────────────────────────────────────────────────────
describe("POST /api/v2/feedback (Node-owned)", () => {
  it("returns 400 when interactionId is missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/feedback",
      payload: { message: "سؤال غير واضح", rating: 2, lang: "ar" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 200 with feedbackId when interactionId is provided", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/feedback",
      payload: { interactionId: "test-interaction-001", helpful: true, rating: 4, comment: "جيد" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body).toHaveProperty("feedbackId");
  });
});
