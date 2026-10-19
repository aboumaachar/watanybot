import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

vi.mock("../auth/rbac.js", () => ({
  requireRole: () => async () => {},
}));

import { adminTickerRoutes } from "../routes/admin-ticker.js";

describe("admin ticker settings", () => {
  it("reads the slower default and persists an allowed cycle duration", async () => {
    let setting: { id: string; cycle_ms: number; updated_at: number; updated_by: string | null } | undefined;
    const pluginDb = {
      prepare(sql: string) {
        if (sql === "SELECT cycle_ms FROM ticker_settings WHERE id = ?") return { get: () => setting ? { cycle_ms: setting.cycle_ms } : undefined };
        if (sql === "SELECT id FROM ticker_settings WHERE id = ?") return { get: () => setting ? { id: setting.id } : undefined };
        if (sql.startsWith("INSERT INTO ticker_settings")) return { run: (id: string, cycleMs: number, updatedAt: number, updatedBy: string | null) => { setting = { id, cycle_ms: cycleMs, updated_at: updatedAt, updated_by: updatedBy }; return { changes: 1 }; } };
        if (sql.startsWith("UPDATE ticker_settings")) return { run: (cycleMs: number, updatedAt: number, updatedBy: string | null) => { if (setting) setting = { ...setting, cycle_ms: cycleMs, updated_at: updatedAt, updated_by: updatedBy }; return { changes: setting ? 1 : 0 }; } };
        return { all: () => [], get: () => undefined, run: () => ({ changes: 0 }) };
      },
    };
    const app = Fastify();
    (app as typeof app & { pluginDb: unknown }).pluginDb = pluginDb;
    try {
      await adminTickerRoutes(app);
      await app.ready();
      const before = await app.inject({ method: "GET", url: "/api/admin/ticker/settings" });
      expect(before.statusCode).toBe(200);
      expect(before.json().settings.cycleMs).toBe(240000);

      const saved = await app.inject({ method: "PATCH", url: "/api/admin/ticker/settings", payload: { cycleMs: 180000 } });
      expect(saved.statusCode).toBe(200);
      expect(saved.json().settings.cycleMs).toBe(180000);

      const after = await app.inject({ method: "GET", url: "/api/admin/ticker/settings" });
      expect(after.json().settings.cycleMs).toBe(180000);

      const rejected = await app.inject({ method: "PATCH", url: "/api/admin/ticker/settings", payload: { cycleMs: 10000 } });
      expect(rejected.statusCode).toBe(400);
      expect(rejected.json().error).toBe("TICKER_CYCLE_MS_OUT_OF_RANGE");
    } finally {
      await app.close();
    }
  });
});
