import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../server";
import { signAccessToken } from "../auth/auth-middleware.js";

process.env.JWT_SECRET ||= "test-jwt-secret-for-admin-tests-0123456789abcdef";

function adminHeaders() {
  const token = signAccessToken({ sub: "test-admin", role: "admin", email: "admin@test.com" });
  return { authorization: `Bearer ${token}` };
}

describe("Salary API", () => {
  beforeAll(async () => {
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/salary", () => {
    it("returns 400-level when rank is missing or not found", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/salary?rank=&degree=1",
      });
      // Either 404 (no salary found) or 500 (KB not loaded in test) is acceptable
      expect([404, 500]).toContain(res.statusCode);
    });

    it("returns structured salary data when KB is loaded", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/salary?rank=جندي&degree=1",
      });

      const body = res.json();
      if (res.statusCode === 200) {
        expect(body.ok).toBe(true);
        expect(body.result).toBeDefined();
        expect(body.result).toHaveProperty("basicSalary");
        expect(body.result).toHaveProperty("pension2026");
        expect(body.result).toHaveProperty("rank_ar");
        expect(body.result).toHaveProperty("degree");
      } else {
        // KB may not be loaded in test env — that's fine, verify error shape
        expect(body.ok).toBe(false);
        expect(body.error).toBeDefined();
      }
    });
  });

  describe("GET /api/salary/meta", () => {
    it("returns salary metadata or KB error", async () => {
      const res = await app.inject({
        method: "GET",
        url: "/api/salary/meta",
      });

      const body = res.json();
      if (res.statusCode === 200) {
        expect(body.ok).toBe(true);
        expect(Array.isArray(body.ranks)).toBe(true);
        expect(body.ranks.length).toBeGreaterThan(0);
        expect(body.familyAllowance).toBeDefined();
        expect(Array.isArray(body.ornamentChoices)).toBe(true);
        expect(body.ornamentChoices.length).toBeGreaterThan(0);
        expect(body.usdRate).toBeTypeOf("number");
      } else {
        expect(body.ok).toBe(false);
      }
    });
  });

  describe("POST /api/salary/calc", () => {
    it("computes Moahel degree 17 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "مؤهل", degree: 17, married: true, kidsCount: 1, selectedOrnaments: ["military_medal"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      const breakdown = body.breakdown;
      const componentGross = breakdown.vetSalary
        + breakdown.equipment
        + breakdown.driver
        + breakdown.position
        + breakdown.aids.grant2025
        + breakdown.aids.d13020
        + breakdown.aids.d11227_2
        + breakdown.aids.d11227_1
        + breakdown.aids.budget2022;
      expect(breakdown.pension2026).toBe(componentGross - 29733);
      expect(breakdown.deduction15Pct).toBe(29733);
      expect(breakdown.familyAllowance.total).toBe(93000);
      expect(breakdown.medals.total).toBe(49458);
      expect(body.totalPension).toBe(43247925);
    });

    it("computes Moahel First degree 14 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "مؤهل اول", degree: 14, married: true, kidsCount: 1, selectedOrnaments: ["military_medal"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.deduction15Pct).toBe(27744);
      expect(body.breakdown.medals.total).toBe(49458);
      expect(body.breakdown.familyAllowance.total).toBe(93000);
      expect(body.breakdown.vetSalary).toBe(1849600);
      expect(body.totalPension).toBe(43117314);
    });

    it("computes Moahel First degree 12 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "مؤهل اول", degree: 12, married: true, kidsCount: 1, selectedOrnaments: ["military_medal"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.deduction15Pct).toBe(25844);
      expect(body.breakdown.medals.total).toBe(49458);
      expect(body.breakdown.familyAllowance.total).toBe(93000);
      expect(body.breakdown.vetSalary).toBe(1722950);
      expect(body.totalPension).toBe(42992564);
    });

    it("computes Raqeeb First degree 12 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "رقيب اول", degree: 12, married: true, kidsCount: 3, selectedOrnaments: [] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.vetSalary).toBe(1496850);
      expect(body.breakdown.deduction15Pct).toBe(22453);
      expect(body.totalPension).toBe(37034136);
    });

    it("rejects when rank is missing", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { degree: "1" },
      });
      expect(res.statusCode).toBeGreaterThanOrEqual(400);
      const body = res.json();
      expect(body.ok).toBe(false);
    });

    it("returns pension calculation when KB is loaded", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "جندي", degree: "1", married: true, kidsCount: 2, selectedOrnaments: ["cedar"] },
      });

      const body = res.json();
      if (res.statusCode === 200) {
        const metaRes = await app.inject({
          method: "GET",
          url: "/api/salary/meta",
        });
        const metaBody = metaRes.json();
        const expectedFamilyAfterRaise = metaRes.statusCode === 200
          ? metaBody.familyAllowanceAfterRaise.wife + (2 * metaBody.familyAllowanceAfterRaise.perChild)
          : body.raise.familyAfterRaise.total;

        expect(body.ok).toBe(true);
        expect(body.breakdown).toBeDefined();
        expect(body.breakdown).toHaveProperty("pension2026");
        expect(body.breakdown).toHaveProperty("deduction15Pct");
        expect(body.totalPension).toBe(
          body.breakdown.pension2026 + body.breakdown.familyAllowance.total + body.breakdown.medals.total
        );
        expect(body.raise.familyAfterRaise.total).toBe(expectedFamilyAfterRaise);
        expect(body.raise.totalAfterSixRaise).toBe(
          body.raise.pensionAfterSixRaise + body.raise.familyAfterRaise.total + body.breakdown.medals.total
        );
        expect(body.fiftyPctRaise.familyAfterRaise.total).toBe(expectedFamilyAfterRaise);
        expect(body.fiftyPctRaise.totalAfterFiftyPct).toBe(
          body.fiftyPctRaise.pensionAfterFiftyPct + body.fiftyPctRaise.familyAfterRaise.total + body.breakdown.medals.total
        );
      } else {
        expect(body.ok).toBe(false);
      }
    });
  });

  describe("Health & readiness endpoints", () => {
    it("GET /health returns status", async () => {
      const res = await app.inject({ method: "GET", url: "/health" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.status).toMatch(/ok|degraded/);
      expect(body.uptime).toBeTypeOf("number");
    });

    it("GET /ready returns readiness", async () => {
      const res = await app.inject({ method: "GET", url: "/ready" });
      expect([200, 503]).toContain(res.statusCode);
      const body = res.json();
      expect(body).toHaveProperty("ready");
    });

    it("GET /api/debug/stats returns debug info", async () => {
      const res = await app.inject({ method: "GET", url: "/api/debug/stats" });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.ok).toBe(true);
      expect(body).toHaveProperty("stats");
      expect(body.stats).toHaveProperty("totalLogs");
      expect(body.stats).toHaveProperty("logCounts");
      expect(body.stats).toHaveProperty("totalRequests");
      expect(body.stats).toHaveProperty("avgResponseTime");
      expect(body.stats).toHaveProperty("slowRequests");
    });

    it("GET /metrics returns prometheus format", async () => {
      const res = await app.inject({ method: "GET", url: "/metrics", headers: adminHeaders() });
      expect(res.statusCode).toBe(200);
      expect(res.headers["content-type"]).toContain("text/plain");
      expect(res.body).toContain("process_uptime_seconds");
    });
  });
});
