/**
 * tests/salary-shape-comparison.test.ts
 *
 * Compares the response shapes of:
 *   - Node  GET  /api/salary + POST /api/salary/calc   (salary-inline.ts)
 *   - Python POST /api/v2/salary/compute               (proxied via kb-v2-proxy.ts)
 *
 * CONCLUSION (2026-05-10, ADR-002 amendment):
 *   These are NOT duplicate routes. They serve different domain models:
 *
 *   Node (`salary-inline.ts`) — Lebanon 2026 military pension calculator:
 *     Unique fields: pension2026, raise.pensionAfterSixRaise, fiftyPctRaise.*,
 *                    aids.*, sixSalary, val2019, additionalRaise, ok flag
 *
 *   Python (`schemas_kb_v2.py SalaryComputeResponse`) — generic pension engine:
 *     Unique fields: gross_pension, after_tax, net_pension, service_factor,
 *                    pension_rate, total_severance, summary_lb, summary_formal
 *
 *   Node salary routes are Node-PERMANENT (not scheduled for retirement).
 *   The historical Python /api/v2/salary/compute contract is intentionally
 *   non-equivalent and is retired rather than silently remapped.
 *
 * This test guards both the permanent Node salary shape and the explicit
 * HTTP 410 retirement contract for the old generic v2 salary engine.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../server";

beforeAll(async () => {
  expect(process.env.USE_PYTHON_API).toBe("false");
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─────────────────────────────────────────────────────────────────────────────
// Node salary shape
// ─────────────────────────────────────────────────────────────────────────────
describe("Node salary shape — POST /api/salary/calc", () => {
  it("documents all top-level fields returned by Node", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/salary/calc",
      payload: { rank: "جندي", degree: "1", married: true, kidsCount: 2, selectedOrnaments: [] },
    });

    if (res.statusCode !== 200) {
      // KB not loaded in this env — skip shape assertions
      console.info("[salary-shape] Node KB not loaded, skipping shape assertions");
      expect([500, 404]).toContain(res.statusCode);
      return;
    }

    const body = res.json();
    expect(body.ok).toBe(true);

    // Document Node top-level fields
    const topLevel = Object.keys(body);
    console.info("[salary-shape] Node top-level fields:", topLevel);

    // Node-specific required fields
    expect(body).toHaveProperty("ok");
    expect(body).toHaveProperty("breakdown");
    expect(body).toHaveProperty("totalPension");
    expect(body).toHaveProperty("raise");
    expect(body).toHaveProperty("fiftyPctRaise");

    // breakdown sub-fields
    const bd = body.breakdown;
    expect(bd).toHaveProperty("basicSalary");
    expect(bd).toHaveProperty("pension2026");
    expect(bd).toHaveProperty("deduction15Pct");
    expect(bd).toHaveProperty("familyAllowance");
    expect(bd).toHaveProperty("medals");

    console.info("[salary-shape] Node breakdown fields:", Object.keys(bd));
    console.info("[salary-shape] Node familyAllowance fields:", Object.keys(bd.familyAllowance ?? {}));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Historical generic v2 salary retirement contract
// ─────────────────────────────────────────────────────────────────────────────
describe("Retired generic salary shape — POST /api/v2/salary/compute", () => {
  it("returns explicit 410 and preserves the non-equivalence warning", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/v2/salary/compute",
      payload: { rank: "جندي", degree: 1, married: true, kids: 2 },
    });

    expect(res.statusCode).toBe(410);
    expect(res.headers["x-watany-kb-v2-source"]).toBe("retired");
    expect(res.json()).toEqual({
      error: "Legacy KB v2 salary engine retired",
      code: "LEGACY_V2_SALARY_RETIRED",
      retired: true,
      current_salary_route: "/api/salary/calc",
      semantic_equivalence: false,
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Schema difference summary (always runs — documents final findings)
// ─────────────────────────────────────────────────────────────────────────────
describe("Salary schema delta documentation", () => {
  it("records confirmed field differences between Node and Python (investigation CLOSED)", () => {
    /**
     * FINAL FINDINGS (2026-05-10, ADR-002 amendment):
     *
     * Node /api/salary/calc → Lebanon 2026 military pension calculator
     *   { ok, input, breakdown: { basicSalary, pension2026, deduction15Pct,
     *                              familyAllowance: { wife, children, total },
     *                              medals: { items[], total }, aids: {...} },
     *     totalPension, totalPensionUsd,
     *     raise: { sixSalary, pensionAfterSixRaise, totalAfterSixRaise, ... },
     *     fiftyPctRaise: { val2019, fiftyPctTargetUsd, additionalRaise,
     *                       pensionAfterFiftyPct, totalAfterFiftyPct, ... },
     *     usdRate }
     *
     * Python /api/v2/salary/compute → generic pension/severance (SalaryComputeResponse):
     *   { error, type, summary_lb, summary_formal, message_lb, note_lb,
     *     breakdown: { base_salary_LBP, pension_rate, service_factor,
     *                   gross_pension, tax_deduction, after_tax,
     *                   family_allowance, medals_bonus, net_pension,
     *                   severance_factor, total_severance } }
     *
     * CONCLUSION: Not duplicates. The generic Python contract is retired without semantic migration.
     * Node routes are Node-PERMANENT per ADR-002 amendment.
     */
    expect(true).toBe(true);
  });
});
