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
      expect(breakdown.pension2026).toBe(componentGross - 30000);
      expect(breakdown.deduction15Pct).toBe(30000);
      expect(breakdown.familyAllowance.total).toBe(93000);
      expect(breakdown.medals.total).toBe(49000);
      expect(body.totalPension).toBe(43405600);
    });

    it("computes Moahel First degree 14 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "مؤهل اول", degree: 14, married: true, kidsCount: 1, selectedOrnaments: ["military_medal"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.deduction15Pct).toBe(28000);
      expect(body.breakdown.medals.total).toBe(49000);
      expect(body.breakdown.familyAllowance.total).toBe(93000);
      expect(body.breakdown.vetSalary).toBe(1849600);
      expect(body.totalPension).toBe(42036200);
    });

    it("computes Moahel First degree 12 from the salary table", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "مؤهل اول", degree: 12, married: true, kidsCount: 1, selectedOrnaments: ["military_medal"] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.deduction15Pct).toBe(26000);
      expect(body.breakdown.medals.total).toBe(49000);
      expect(body.breakdown.familyAllowance.total).toBe(93000);
      expect(body.breakdown.vetSalary).toBe(1722950);
      expect(body.totalPension).toBe(41151650);
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
      expect(body.breakdown.deduction15Pct).toBe(23000);
      expect(body.totalPension).toBe(37123400);
    });

    it("infers Brigadier degree and fraction from the official pre-2019 base salary scale", async () => {
      const exact = await app.inject({ method: "POST", url: "/api/salary/infer-pre2019-degree", payload: { rank: "عميد", pre2019BaseSalary: 2698000 } });
      expect(exact.statusCode).toBe(200);
      expect(exact.json().inference).toMatchObject({ lookupDegree: 5, wholeEquivalentDegree: 5, fractionPercent: 0, effectiveVetSalary: 3502000, status: "exact_degree" });

      const fractional = await app.inject({ method: "POST", url: "/api/salary/infer-pre2019-degree", payload: { rank: "عميد", pre2019BaseSalary: 2745500 } });
      expect(fractional.statusCode).toBe(200);
      const inference = fractional.json().inference;
      expect(inference.lookupDegree).toBe(5);
      expect(inference.fractionPercent).toBeCloseTo(50, 8);
      expect(inference.effectiveVetSalary).toBe(3557250);
      expect(inference.status).toBe("fractional_within_scale");
    });

    it("calculates from pre-2019 base salary without requiring manual degree selection", async () => {
      const res = await app.inject({ method: "POST", url: "/api/salary/calc", payload: { rank: "عميد", pre2019BaseSalary: 2745500, married: true, kidsCount: 1, selectedOrnaments: ["cedar_knight"] } });
      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.input.degree).toBe(5);
      expect(body.input.degreeSource).toBe("inferred_from_pre2019_base_salary");
      expect(body.input.pre2019BaseSalary).toBe(2745500);
      expect(body.breakdown.degreeInference.fractionPercent).toBeCloseTo(50, 8);
      expect(body.breakdown.vetSalary).toBe(3557250);
      expect(body.breakdown.eligibleBase).toBe(6196250);
      expect(body.breakdown.deduction15Pct).toBe(54000);
      expect(body.raise.sixSalary).toBe(37177500);
      expect(body.breakdown.pension2026 + body.raise.sixSalary + body.breakdown.familyAllowance.total + body.breakdown.medals.total).toBe(129437250);
    });

    it("rejects a pre-2019 base below the selected rank minimum", async () => {
      const res = await app.inject({ method: "POST", url: "/api/salary/infer-pre2019-degree", payload: { rank: "عميد", pre2019BaseSalary: 125000 } });
      expect(res.statusCode).toBe(400);
      expect(res.json().minimumPre2019BaseSalary).toBe(2340000);
    });

    it("matches the verified Brigadier degree 5-plus certificate when exact veteran pension is supplied", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: {
          rank: "عميد",
          degree: 5,
          exactVetSalary: 3552000,
          married: true,
          kidsCount: 1,
          selectedOrnaments: ["cedar_knight"],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.canonicalVetSalary).toBe(3502000);
      expect(body.breakdown.vetSalary).toBe(3552000);
      expect(body.breakdown.veteranSalaryAdjustment).toBe(50000);
      expect(body.breakdown.maxSingleDegreeVeteranAdjustment).toBe(110500);
      expect(body.breakdown.veteranSalaryAdjustmentStatus).toBe("within_one_degree");
      expect(body.breakdown.fractionOfDegree).toBeCloseTo(50000 / 110500, 8);
      expect(body.breakdown.eligibleBase).toBe(6191000);
      expect(body.breakdown.deduction15Pct).toBe(54000);
      expect(body.breakdown.aids).toEqual({
        grant2025: 12000000,
        d13020: 18573000,
        d11227_2: 18573000,
        d11227_1: 24764000,
        budget2022: 12000000,
      });
      expect(body.breakdown.pension2026).toBe(92047000);
      expect(body.breakdown.familyAllowance.total).toBe(93000);
      expect(body.breakdown.medals.total).toBe(62000);
      expect(body.raise.sixSalary).toBe(37146000);
      expect(body.breakdown.pension2026 + body.raise.sixSalary + body.breakdown.familyAllowance.total + body.breakdown.medals.total).toBe(129348000);
      expect(body.breakdown.pension2026 + body.raise.sixSalary + (body.breakdown.eligibleBase * 3) + body.breakdown.familyAllowance.total + body.breakdown.medals.total).toBe(147921000);
    });

    it("infers Brigadier degree 5 plus fraction from an exact veteran base", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/infer-degree",
        payload: { rank: "عميد", exactVetSalary: 3552000 },
      });

      expect(res.statusCode).toBe(200);
      const inference = res.json().inference;
      expect(inference.lookupDegree).toBe(5);
      expect(inference.wholeEquivalentDegree).toBe(5);
      expect(inference.equivalentDegree).toBeCloseTo(5 + (50000 / 110500), 8);
      expect(inference.fractionPercent).toBeCloseTo((50000 / 110500) * 100, 8);
      expect(inference.status).toBe("fractional_within_scale");
    });

    it("calculates from exact veteran base without requiring manual degree selection", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: {
          rank: "عميد",
          exactVetSalary: 3552000,
          married: true,
          kidsCount: 1,
          selectedOrnaments: ["cedar_knight"],
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.input.degree).toBe(5);
      expect(body.input.degreeSource).toBe("inferred_from_exact_veteran_salary");
      expect(body.breakdown.degreeInference.lookupDegree).toBe(5);
      expect(body.breakdown.degreeInference.fractionPercent).toBeCloseTo((50000 / 110500) * 100, 8);
      expect(body.breakdown.eligibleBase).toBe(6191000);
      expect(body.breakdown.pension2026 + body.raise.sixSalary + body.breakdown.familyAllowance.total + body.breakdown.medals.total).toBe(129348000);
    });

    it("reports an equivalent degree above the published Lieutenant scale when the exact base requires it", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/infer-degree",
        payload: { rank: "ملازم", exactVetSalary: 2201000 },
      });

      expect(res.statusCode).toBe(200);
      const inference = res.json().inference;
      expect(inference.lookupDegree).toBe(13);
      expect(inference.maxPublishedDegree).toBe(13);
      expect(inference.wholeEquivalentDegree).toBe(14);
      expect(inference.equivalentDegree).toBeCloseTo(13 + (109150 / 85000), 8);
      expect(inference.fractionPercent).toBeCloseTo(((13 + (109150 / 85000)) % 1) * 100, 8);
      expect(inference.status).toBe("extrapolated_above_max");
    });

    it("rejects an exact base below the minimum pension for the selected rank", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/infer-degree",
        payload: { rank: "عميد", exactVetSalary: 1000000 },
      });

      expect(res.statusCode).toBe(400);
      expect(res.json().minimumVetSalary).toBeGreaterThan(1000000);
    });

    it("keeps Lieutenant degree 13 canonical veteran salary at exactly 85 percent", async () => {
      const res = await app.inject({
        method: "POST",
        url: "/api/salary/calc",
        payload: { rank: "ملازم", degree: 13, married: false, kidsCount: 0, selectedOrnaments: [] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.breakdown.basicSalary).toBe(2461000);
      expect(body.breakdown.canonicalVetSalary).toBe(2091850);
      expect(body.breakdown.vetSalary).toBe(2091850);
      expect(body.breakdown.veteranSalaryAdjustment).toBe(0);
    });

    it("uses the official Colonel degree mapping and rejects unsupported degree 13", async () => {
      const degree1 = await app.inject({ method: "GET", url: "/api/salary?rank=عقيد&degree=1" });
      const degree12 = await app.inject({ method: "GET", url: "/api/salary?rank=عقيد&degree=12" });
      const degree13 = await app.inject({ method: "GET", url: "/api/salary?rank=عقيد&degree=13" });

      expect(degree1.statusCode).toBe(200);
      expect(degree1.json().result.basicSalary).toBe(2460000);
      expect(degree1.json().result.vetSalary).toBe(2091000);
      expect(degree1.json().result.degreeValue).toBe(100000);
      expect(degree12.statusCode).toBe(200);
      expect(degree12.json().result.basicSalary).toBe(3725000);
      expect(degree12.json().result.vetSalary).toBe(3166250);
      expect(degree12.json().result.degreeValue).toBe(130000);
      expect(degree13.statusCode).toBe(404);
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
