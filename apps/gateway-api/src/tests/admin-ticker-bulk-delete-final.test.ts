import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";

const roleCalls = vi.hoisted(() => [] as string[]);

vi.mock("../auth/rbac.js", () => ({
  requireRole: (role: string) => {
    roleCalls.push(role);
    return async () => {};
  },
}));

import { adminTickerRoutes } from "../routes/admin-ticker.js";

describe("admin ticker delete persistence contract", () => {
  it("lists stable IDs, deletes exactly one persisted row, and returns 404 after deletion", async () => {
    roleCalls.length = 0;

    const rows = new Map<string, Record<string, unknown>>([
      ["ticker-a", { id: "ticker-a", title: "A", priority: 5, created_at: 1 }],
      ["ticker-b", { id: "ticker-b", title: "B", priority: 4, created_at: 2 }],
    ]);

    const pluginDb = {
      prepare(sql: string) {
        if (sql.startsWith("SELECT * FROM ticker_items")) {
          return {
            all: () => [...rows.values()],
          };
        }

        if (sql.startsWith("DELETE FROM ticker_items WHERE id = ?")) {
          return {
            run: (id: string) => ({ changes: rows.delete(id) ? 1 : 0 }),
          };
        }

        // Other registered ticker routes are not invoked by this focused test.
        return {
          all: () => [],
          get: () => undefined,
          run: () => ({ changes: 0 }),
        };
      },
    };

    const app = Fastify();
    (app as typeof app & { pluginDb: unknown }).pluginDb = pluginDb;

    try {
      await adminTickerRoutes(app);
      await app.ready();

      expect(roleCalls.length).toBeGreaterThan(0);
      expect(roleCalls.every((role) => role === "admin")).toBe(true);

      const before = await app.inject({ method: "GET", url: "/api/admin/ticker/items" });
      expect(before.statusCode).toBe(200);
      expect(before.json().items.map((item: { id: string }) => item.id)).toEqual(
        expect.arrayContaining(["ticker-a", "ticker-b"]),
      );

      const deleted = await app.inject({
        method: "DELETE",
        url: "/api/admin/ticker/items/ticker-a",
      });
      expect(deleted.statusCode).toBe(200);
      expect(deleted.json()).toEqual({ ok: true });

      const after = await app.inject({ method: "GET", url: "/api/admin/ticker/items" });
      expect(after.statusCode).toBe(200);
      expect(after.json().items.map((item: { id: string }) => item.id)).toEqual(["ticker-b"]);

      const missing = await app.inject({
        method: "DELETE",
        url: "/api/admin/ticker/items/ticker-a",
      });
      expect(missing.statusCode).toBe(404);
      expect(missing.json()).toEqual({ error: "not found" });
    } finally {
      await app.close();
    }
  });
});
