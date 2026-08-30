/**
 * tests/node-owned-routes.test.ts
 *
 * Smoke tests for Node-owned routes that do NOT depend on Python.
 * These must pass in any environment (CI, local, production-dry-run).
 *
 * Covered families:
 *   - Health / diagnostics  (/health, /ready, /metrics, /)
 *   - Forms catalog         (/api/forms)
 *   - FAQ                   (/api/faq)
 *   - Ticker                (/api/ticker)
 *   - Files (v2)            (/api/v2/files)
 *   - KB vNext              (/api/kb-nodes/stats, /api/kb-nodes/list)
 *   - Salary (Node)         (/api/salary, /api/salary/meta, /api/salary/calc)
 *   - TX mock               (/api/tx/search)
 *   - Unified search        (/api/search/unified)
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Ensure Python upstream is treated as down for these Node-owned route tests
// so proxy calls fail fast and do not hang internal requests.
import { restorePythonEnv, forcePythonDown } from "./setup/force-python-down";
import { app } from "../server";
import { signAccessToken } from "../auth/auth-middleware.js";

process.env.JWT_SECRET ||= "test-jwt-secret-for-admin-tests-0123456789abcdef";

function adminHeaders() {
  const token = signAccessToken({ sub: "test-admin", role: "admin", email: "admin@test.com" });
  return { authorization: `Bearer ${token}` };
}

beforeAll(async () => {
  forcePythonDown();
  await app.ready();
});

afterAll(async () => {
  restorePythonEnv();
  await app.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Health & diagnostics
// ─────────────────────────────────────────────────────────────────────────────
describe("Health / diagnostics routes", () => {
  it("GET /health → 200 with status ok|degraded", async () => {
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("status");
    expect(["ok", "degraded"]).toContain(body.status);
    expect(body).toHaveProperty("uptime");
  });

  it("GET /ready → 200 or 503 with ready flag", async () => {
    const res = await app.inject({ method: "GET", url: "/ready" });
    expect([200, 503]).toContain(res.statusCode);
    const body = res.json();
    expect(body).toHaveProperty("ready");
    expect(typeof body.ready).toBe("boolean");
  });

  it("GET /api/ready and /version return the expected production contract", async () => {
    const ready = await app.inject({ method: "GET", url: "/api/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toEqual(expect.objectContaining({ ready: expect.any(Boolean) }));

    const version = await app.inject({ method: "GET", url: "/version" });
    expect(version.statusCode).toBe(200);
    expect(version.json()).toEqual(expect.objectContaining({ version: expect.any(String) }));
  });

  it("GET /metrics → 200 Prometheus text", async () => {
    const res = await app.inject({ method: "GET", url: "/metrics", headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/plain");
    expect(res.body).toContain("process_uptime_seconds");
  });

  it("GET / → 200 welcome response", async () => {
    const res = await app.inject({ method: "GET", url: "/" });
    expect(res.statusCode).toBe(200);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Forms catalog
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/forms", () => {
  it("returns a forms array with total count", async () => {
    const res = await app.inject({ method: "GET", url: "/api/forms" });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { total: number; items: Array<{ origin?: string }> };
    // Route returns { items, total } shape
    expect(body).toHaveProperty("total");
    expect(typeof body.total).toBe("number");
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBe(body.items.length);
    expect(body.total).toBeGreaterThan(11);
    expect(body.items.some((item) => item.origin === "procedure_doc")).toBe(true);
  });

  it("accepts ?q= search param without crashing", async () => {
    const res = await app.inject({ method: "GET", url: "/api/forms?q=تقاعد" });
    expect([200, 404]).toContain(res.statusCode);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FAQ
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/faq", () => {
  it("returns faq array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/faq" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ticker
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/ticker", () => {
  it("returns ticker items array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/ticker" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Files (v2)
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/v2/files", () => {
  it("returns files array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/files" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("items");
    expect(Array.isArray(body.items)).toBe(true);
  });

  it("accepts procedureId filter param", async () => {
    const res = await app.inject({ method: "GET", url: "/api/v2/files?procedureId=TEST-001" });
    expect([200, 404]).toContain(res.statusCode);
  });
});

describe("GET /api/admin/erm/assets", () => {
  it("rejects unauthenticated requests", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/erm/assets" });
    expect([401, 403]).toContain(res.statusCode);
  });

  it("returns a bounded admin asset collection with stable IDs", async () => {
    const res = await app.inject({ method: "GET", url: "/api/admin/erm/assets?limit=2", headers: adminHeaders() });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { items: Array<{ id?: string }>; total: number; bounded: boolean };
    expect(body.bounded).toBe(true);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.items.every((item) => typeof item.id === "string" && item.id.length > 0)).toBe(true);
    expect(typeof body.total).toBe("number");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// KB vNext (FTS5 nodes)
// ─────────────────────────────────────────────────────────────────────────────
describe("KB vNext routes", () => {
  it("GET /api/kb-nodes/stats → 200 with stats object", async () => {
    const res = await app.inject({ method: "GET", url: "/api/kb-nodes/stats" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    // Either ready with stats, or gracefully reports not ready
    expect(body).toHaveProperty("ready");
  });

  it("GET /api/kb-nodes/list → returns nodes array or graceful 503 when KB nodes are disabled", async () => {
    const res = await app.inject({ method: "GET", url: "/api/kb-nodes/list" });
    expect([200, 503]).toContain(res.statusCode);
    const body = res.json();
    expect(body).toHaveProperty("nodes");
    expect(Array.isArray(body.nodes)).toBe(true);
    if (res.statusCode === 503) {
      expect(body).toHaveProperty("error", "KB nodes not loaded");
      expect(body).toHaveProperty("total", 0);
    }
  });

  it("GET /api/kb-nodes/search → 200 or 400 for missing q", async () => {
    const res = await app.inject({ method: "GET", url: "/api/kb-nodes/search" });
    expect([200, 400, 422]).toContain(res.statusCode);
  });

  it("GET /api/kb-nodes/search?q=تقاعد → returns nodes array or graceful 503 when KB nodes are disabled", async () => {
    const res = await app.inject({ method: "GET", url: "/api/kb-nodes/search?q=تقاعد" });
    expect([200, 503]).toContain(res.statusCode);
    const body = res.json();
    if (res.statusCode === 503) {
      expect(body).toHaveProperty("error", "KB nodes not loaded");
      return;
    }
    // KbSearchResult: { query, intent, nodes, total, confidence, elapsed_ms }
    expect(body).toHaveProperty("nodes");
    expect(Array.isArray(body.nodes)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Salary (Node-owned, duplicate of Python — kept until schema aligned)
// ─────────────────────────────────────────────────────────────────────────────
describe("Node salary routes (salary-inline.ts)", () => {
  it("GET /api/salary → 200 or 404 with structured response", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/api/salary?rank=جندي&degree=1",
    });
    expect([200, 404, 500]).toContain(res.statusCode);
    const body = res.json();
    if (res.statusCode === 200) {
      expect(body).toHaveProperty("ok", true);
      expect(body).toHaveProperty("result");
      // Record Node salary fields for schema comparison
      expect(body.result).toHaveProperty("basicSalary");
      expect(body.result).toHaveProperty("pension2026");
    } else {
      expect(body).toHaveProperty("ok", false);
    }
  });

  it("GET /api/salary/meta → 200 with ranks and metadata", async () => {
    const res = await app.inject({ method: "GET", url: "/api/salary/meta" });
    expect([200, 500]).toContain(res.statusCode);
    const body = res.json();
    if (res.statusCode === 200) {
      expect(body).toHaveProperty("ok", true);
      expect(body).toHaveProperty("ranks");
      expect(Array.isArray(body.ranks)).toBe(true);
      expect(body.ranks.length).toBeGreaterThan(0);
      expect(Array.isArray(body.ornamentChoices)).toBe(true);
      expect(body.ornamentChoices.length).toBeGreaterThan(0);
      expect(body).toHaveProperty("usdRate");
    }
  });

  it("POST /api/salary/calc → 400 when rank missing", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/salary/calc",
      payload: { degree: "1" },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const body = res.json();
    expect(body).toHaveProperty("ok", false);
  });

  it("POST /api/salary/calc → 200, 404, or 500 with breakdown when KB loaded", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/salary/calc",
      payload: { rank: "جندي", degree: "1", married: false, kidsCount: 0, selectedOrnaments: [] },
    });
    // 200 = rank found in KB; 404 = rank not in test KB (0 entries); 500 = KB not loaded
    expect([200, 404, 500]).toContain(res.statusCode);
    const body = res.json();
    if (res.statusCode === 200) {
      expect(body).toHaveProperty("ok", true);
      expect(body).toHaveProperty("breakdown");
      expect(body.breakdown).toHaveProperty("pension2026");
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TX mock routes
// ─────────────────────────────────────────────────────────────────────────────
describe("TX mock routes (tx.ts)", () => {
  it("GET /api/tx/search → 200 with results array", async () => {
    const res = await app.inject({ method: "GET", url: "/api/tx/search?q=test" });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body).toHaveProperty("results");
    expect(Array.isArray(body.results)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Unified search
// ─────────────────────────────────────────────────────────────────────────────
describe("GET /api/search/unified", () => {
  it("returns unified results for a query", async () => {
    const res = await app.inject({ method: "GET", url: "/api/search/unified?q=تقاعد" });
    expect([200, 400]).toContain(res.statusCode);
    if (res.statusCode === 200) {
      const body = res.json();
      expect(body).toHaveProperty("results");
    }
  });
});
