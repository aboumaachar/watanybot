import Fastify from "fastify";
import { afterAll, describe, expect, it, vi } from "vitest";
import { closePool } from "../lib/db.js";
vi.mock("../procedures/indexer.js", () => ({
  loadIndex: vi.fn().mockResolvedValue({ procedures: [{ id: "PROC-DB-1" }] }),
}));
import { faqRoutes } from "./faq.js";

const isolated = process.env.DB_NAME === "apex_r025_validation_20261008" &&
  process.env.DB_PORT === "5433" &&
  ["localhost", "127.0.0.1"].includes(process.env.DB_HOST || "") &&
  !process.env.DATABASE_URL;

describe.skipIf(!isolated)("R025 curated FAQ real PostgreSQL read-only public route", () => {
  afterAll(async () => { await closePool(); });
  it("returns only published approved and source-grounded FAQs", async () => {
    const app = Fastify();
    await app.register(faqRoutes);
    try {
      const res = await app.inject({ method: "GET", url: "/api/v2/faq/curated" });
      expect(res.statusCode, res.body).toBe(200);
      const result = res.json() as { editorial: boolean; latest: Array<Record<string, unknown>>; trending: Array<Record<string, unknown>> };
      expect(result.editorial).toBe(true);
      expect(result.latest.some((row) => row.id === "curated-FAQ-DB-ACTIVE")).toBe(true);
      expect(result.latest.some((row) => row.id === "curated-FAQ-DB-REJECTED")).toBe(false);
      expect(JSON.stringify(result)).not.toContain("reviewedBy");
      expect(JSON.stringify(result)).not.toContain("reviewNotes");
      expect(JSON.stringify(result)).not.toContain("createdBy");
    } finally { await app.close(); }
  });
  it("preserves the original generated endpoint contract", async () => {
    const app = Fastify(); await app.register(faqRoutes);
    try {
      const res = await app.inject({ method: "GET", url: "/api/v2/faq?limit=5" });
      expect(res.statusCode).toBe(200);
      expect(res.json()).toHaveProperty("items");
      expect(res.json()).toHaveProperty("total");
    } finally { await app.close(); }
  });
});
