// APEX_MANAGED_TEST_GATE4A_20261012
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { kbV2ProxyRoutes } from "../routes/kb-v2-proxy";

describe("Gate 4A Node-first Python retirement", () => {
  it("returns explicit 410 for retired legacy v2 salary without contacting Python", async () => {
    let called = 0;
    const app = Fastify({ logger: false });
    await app.register(kbV2ProxyRoutes, {
      getPythonBase: () => { called += 1; throw new Error("PYTHON_MUST_NOT_BE_USED"); },
      usePython: false,
    });
    try {
      await app.ready();
      const response = await app.inject({
        method: "POST",
        url: "/api/v2/salary/compute",
        payload: { rank: "synthetic", degree: 1 },
      });
      expect(response.statusCode).toBe(410);
      expect(response.headers["x-watany-kb-v2-source"]).toBe("retired");
      expect(response.json()).toMatchObject({
        code: "LEGACY_V2_SALARY_RETIRED",
        retired: true,
        current_salary_route: "/api/salary/calc",
        semantic_equivalence: false,
      });
      expect(called).toBe(0);
    } finally {
      await app.close();
    }
  });
});
