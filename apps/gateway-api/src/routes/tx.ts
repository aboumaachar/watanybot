/**
 * Transaction search/detail routes — demo tx endpoints.
 * Extracted from server.ts.
 *
 * DEPRECATED: No frontend callers found (confirmed 2026-05-10 — grep of all
 * apps/*.{ts,tsx,js,jsx} found zero references to /api/tx/).
 * Safe to delete pending product confirmation that TX feature is not planned.
 */
import type { FastifyPluginAsync } from "fastify";
import type { TxItem, TxDetail } from "../types/domain";

interface TxRoutesOptions {
  mockTx: TxItem[];
  mockDetail: Record<number, TxDetail>;
}

export const txRoutes: FastifyPluginAsync<TxRoutesOptions> = async (app, { mockTx, mockDetail }) => {
  app.get("/api/tx/search", async (req, reply) => {
    const q = String((req.query as { q?: string }).q || "").trim();
    if (!q) {
      reply.code(400);
      return { error: "q required" } as const;
    }
    const results = mockTx.filter((item) => (item.title_ar + " " + item.preview).includes(q));
    return { results } as const;
  });

  app.get<{ Params: { id: string } }>("/api/tx/:id", async (req, reply) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      reply.code(400);
      return { error: "invalid id" } as const;
    }
    const detail = mockDetail[id];
    if (!detail) {
      reply.code(404);
      return { error: "not found" } as const;
    }
    return detail;
  });
};
