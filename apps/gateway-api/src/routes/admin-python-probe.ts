/**
 * routes/admin-python-probe.ts
 * POST /api/admin/python/probe
 * Tests connectivity to the Python backend and updates the mutable pythonBase.
 * Previously an inline route in server.ts.
 */
import { request } from "undici";
import type { FastifyInstance } from "fastify";
import { getPythonBase, setPythonBase } from "../lib/config";
import { requireRole } from "../auth/rbac.js";

export async function adminPythonProbeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/admin/python/probe", { preHandler: [requireRole("admin")] }, async (req: any) => {
    const base = String(req.body?.base || "").trim();
    if (!base) return { ok: false, error: "base required" };

    setPythonBase(base);

    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 1500);
    const started    = Date.now();

    try {
      const res = await request(`${getPythonBase()}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      return {
        ok: true,
        base: getPythonBase(),
        okHost: res.statusCode >= 200 && res.statusCode < 300,
        statusCode: res.statusCode,
        latencyMs: Date.now() - started,
      };
    } catch (err: unknown) {
      return {
        ok:    false,
        base:  getPythonBase(),
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      clearTimeout(timeout);
    }
  });
}
