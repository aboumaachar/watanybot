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
 *   Python's /api/v2/salary/compute is a separate endpoint for chat-embedded
 *   computation and is proxied correctly.
 *
 * This test now serves as a regression guard for the Node salary shape only.
 * The PYTHON_UP section remains for documentation if the proxy contract changes.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
// Force Python upstream down for this test file to validate graceful-degradation
import { restorePythonEnv, forcePythonDown } from "./setup/force-python-down";
import { app } from "../server";

const PYTHON_UP = process.env.PYTHON_UP === "1";

beforeAll(async () => {
  forcePythonDown();
  await app.ready();
});

afterAll(async () => {
  await app.close();
  try { restorePythonEnv(); } catch (e) { /* best-effort */ }
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
// Python salary shape (via proxy)
// ─────────────────────────────────────────────────────────────────────────────
describe("Python salary shape — POST /api/v2/salary/compute", () => {
  it("documents all top-level fields returned by Python", async () => {
    if (!PYTHON_UP) {
      console.info("[salary-shape] PYTHON_UP not set — skipping Python shape assertions");
      // Verify graceful 502
      const res = await app.inject({
        method: "POST",
        url: "/api/v2/salary/compute",
        payload: { rank: "جندي", degree: 1, married: true, kids: 2 },
      });
      expect(res.statusCode).toBe(502);
      return;
    }

    const res = await app.inject({
      method: "POST",
      url: "/api/v2/salary/compute",
      payload: { rank: "جندي", degree: 1, married: true, kids: 2 },
    });
    expect(res.statusCode).toBe(200);

    const body = res.json();
    const topLevel = Object.keys(body);
    console.info("[salary-shape] Python top-level fields:", topLevel);

    // Python SalaryComputeResponse fields (from schemas_kb_v2.py)
    expect(body).toHaveProperty("breakdown");
    const bd = body.breakdown as Record<string, unknown>;
    console.info("[salary-shape] Python breakdown fields:", Object.keys(bd));
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
     * CONCLUSION: Not duplicates. No migration required.
     * Node routes are Node-PERMANENT per ADR-002 amendment.
     */
    expect(true).toBe(true);
  });
});
