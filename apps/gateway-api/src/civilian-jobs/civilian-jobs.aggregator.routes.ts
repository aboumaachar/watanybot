/**
 * Wave 03 — Admin routes for source registry, crawl runs,
 * import review queue, and compliance checks.
 *
 * All routes require admin role.
 * Boundary: no access to إعلانات التطويع data here.
 */
import type { FastifyInstance } from "fastify";
import { requireRole } from "../auth/rbac.js";


function watanySafeStringField(value: unknown, fallback = ""): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") return String(value);
  return fallback;
}

function watanySafeStringArrayField(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => watanySafeStringField(item)).filter(Boolean);
}
import {
  listSources,
  getSource,
  upsertSource,
  recordComplianceCheck,
  listComplianceChecks,
  startCrawlRun,
  completeCrawlRun,
  failCrawlRun,
  listCrawlRuns,
  ingestRawJob,
  listImportQueue,
  getImportedOpportunity,
  processImportReview,
  listCrawlItems,
} from "./civilian-jobs.aggregator.service.js";

export async function registerCivilianJobsAggregatorRoutes(app: FastifyInstance) {
  const admin = [requireRole("admin")];

  // ── Source registry ───────────────────────────────────────────────

  app.get("/api/admin/opportunities/sources/registry", { preHandler: admin }, async () => {
    return { items: listSources() };
  });

  app.get("/api/admin/opportunities/sources/registry/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const src = getSource(id);
    if (!src) return reply.code(404).send({ error: "NOT_FOUND" });
    return { item: src };
  });

  app.put("/api/admin/opportunities/sources/registry/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const item = upsertSource({ id, name: String(body.name || id), url: String(body.url || ""), ...body });
      return reply.code(200).send({ item });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "UPSERT_FAILED" });
    }
  });

  // ── Compliance ────────────────────────────────────────────────────

  app.get("/api/admin/opportunities/sources/:id/compliance", { preHandler: admin }, async (req) => {
    const { id } = req.params as { id: string };
    return { items: listComplianceChecks(id) };
  });

  app.post("/api/admin/opportunities/sources/:id/compliance", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const record = recordComplianceCheck(id, {
        robotsTxtAllows: Boolean(body.robotsTxtAllows),
        termsApproved: Boolean(body.termsApproved),
        requiresLogin: Boolean(body.requiresLogin),
        hasAntiBot: Boolean(body.hasAntiBot),
        approved: Boolean(body.approved),
        notes: String(body.notes || ""),
      });
      return reply.code(201).send({ item: record });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "COMPLIANCE_FAILED" });
    }
  });

  // ── Crawl runs ────────────────────────────────────────────────────

  app.get("/api/admin/opportunities/crawl-runs", { preHandler: admin }, async (req) => {
    const q = (req.query || {}) as Record<string, string | undefined>;
    return { items: listCrawlRuns(q.sourceId) };
  });

  app.post("/api/admin/opportunities/crawl-runs/start", { preHandler: admin }, async (req, reply) => {
    const body = (req.body || {}) as { sourceId?: string };
    try {
      const run = startCrawlRun(body.sourceId || "");
      return reply.code(201).send({ item: run });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "START_FAILED" });
    }
  });

  app.post("/api/admin/opportunities/crawl-runs/:id/complete", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as {
      itemsDiscovered?: number;
      itemsNormalized?: number;
      itemsDuplicate?: number;
      itemsQueued?: number;
    };
    try {
      const run = completeCrawlRun(id, {
        itemsDiscovered: Number(body.itemsDiscovered || 0),
        itemsNormalized: Number(body.itemsNormalized || 0),
        itemsDuplicate: Number(body.itemsDuplicate || 0),
        itemsQueued: Number(body.itemsQueued || 0),
      });
      return reply.send({ item: run });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "COMPLETE_FAILED" });
    }
  });

  app.post("/api/admin/opportunities/crawl-runs/:id/fail", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { errorMessage?: string };
    try {
      const run = failCrawlRun(id, body.errorMessage || "Unknown error");
      return reply.send({ item: run });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "FAIL_FAILED" });
    }
  });

  // ── Raw ingest (manual CSV/JSON import via API) ───────────────────

  app.post("/api/admin/opportunities/ingest", { preHandler: admin }, async (req, reply) => {
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const result = ingestRawJob({
        crawlRunId: String(body.crawlRunId || "manual"),
        sourceId: String(body.sourceId || "manual"),
        sourceName: String(watanySafeStringField(body.sourceName, "Manual admin entry")),
        rawTitle: String(body.rawTitle || ""),
        rawOrganization: body.rawOrganization ? String(body.rawOrganization) : undefined,
        rawLocation: body.rawLocation ? String(body.rawLocation) : undefined,
        rawUrl: String(body.rawUrl || "internal://manual"),
        rawPostedAt: body.rawPostedAt ? String(body.rawPostedAt) : undefined,
        rawCategory: body.rawCategory ? String(body.rawCategory) : undefined,
      });
      return reply.code(201).send(result);
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "INGEST_FAILED" });
    }
  });

  app.get("/api/admin/opportunities/crawl-items", { preHandler: admin }, async (req) => {
    const q = (req.query || {}) as Record<string, string | undefined>;
    return { items: listCrawlItems(q.crawlRunId) };
  });

  // ── Import review queue ───────────────────────────────────────────

  app.get("/api/admin/opportunities/imports", { preHandler: admin }, async (req) => {
    const q = (req.query || {}) as Record<string, string | undefined>;
    return { items: listImportQueue(q.status as never) };
  });

  app.get("/api/admin/opportunities/imports/:id", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const item = getImportedOpportunity(id);
    if (!item) return reply.code(404).send({ error: "NOT_FOUND" });
    return { item };
  });

  app.post("/api/admin/opportunities/imports/:id/review", { preHandler: admin }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = (req.body || {}) as { decision?: string; adminNote?: string };
    if (body.decision !== "APPROVE" && body.decision !== "REJECT") {
      return reply.code(400).send({ error: "decision must be APPROVE or REJECT" });
    }
    try {
      const item = processImportReview({
        importedOpportunityId: id,
        decision: body.decision,
        adminNote: body.adminNote,
      });
      return reply.send({ item });
    } catch (e) {
      return reply.code(400).send({ error: e instanceof Error ? e.message : "REVIEW_FAILED" });
    }
  });
}
