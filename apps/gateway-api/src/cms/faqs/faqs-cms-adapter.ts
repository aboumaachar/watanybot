import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z, ZodError } from "zod";
import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from "../../admin-authority/adminAuthorityGuard.js";
import { loadIndex } from "../../procedures/indexer.js";
import { GenericCmsService, GenericCmsServiceError, type GenericCmsView } from "../storage/genericCmsService.js";
import { createFaqAtomic, updateFaqAtomic, FAQ_CMS_CONFIG } from "./faqs-transaction.js";

/**
 * R-025 guarded FAQ editorial owner.
 * Do not mount registerGenericCmsRoutes for "faqs": it permits direct status
 * mutation and would bypass source review and explicit approval.
 * The public /api/v2/faq generator remains unchanged.
 */
const faqService = new GenericCmsService(FAQ_CMS_CONFIG);
const policy = (key: string) => ({ preHandler: [buildAdminAuthorityPreHandler(getRoutePolicyByKey(key))] });
const sourceId = z.string().trim().min(1).max(160);
const payloadSchema = z.object({
  answer: z.string().trim().max(5000).default(""),
  category: z.string().trim().max(160).default(""),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
  sourceReferences: z.array(sourceId).max(25).default([]),
}).strict();
const createSchema = z.object({
  publicId: z.string().trim().min(1).max(160),
  title: z.string().trim().min(1).max(300),
  status: z.literal("DRAFT").optional(),
  payload: payloadSchema.default({ answer: "", category: "", tags: [], sourceReferences: [] }),
}).strict();
// The edit schema must not inherit defaults: unspecified values must survive PATCH.
const editPayloadSchema = z.object({
  answer: z.string().trim().max(5000).optional(),
  category: z.string().trim().max(160).optional(),
  tags: z.array(z.string().trim().min(1).max(80)).max(30).optional(),
  sourceReferences: z.array(sourceId).max(25).optional(),
}).strict();
const editSchema = z.object({
  expectedVersion: z.coerce.number().int().positive(),
  title: z.string().trim().min(1).max(300).optional(),
  payload: editPayloadSchema.optional(),
}).strict().refine((v) => v.title !== undefined || v.payload !== undefined, "no_changes");
const versionSchema = z.object({ expectedVersion: z.coerce.number().int().positive() }).strict();
const rejectSchema = versionSchema.extend({ reason: z.string().trim().min(5).max(1000) });
const rankSchema = versionSchema.extend({
  latestRank: z.number().int().min(1).max(9999).nullable().optional(),
  trendingRank: z.number().int().min(1).max(9999).nullable().optional(),
}).refine((v) => v.latestRank !== undefined || v.trendingRank !== undefined, "no_ranks");
type FaqEditable = z.infer<typeof payloadSchema>;
function actor(request: FastifyRequest): string {
  if (!request.user?.id) throw new GenericCmsServiceError("FAQ_ACTOR_REQUIRED", 409);
  return request.user.id;
}
function reject(code: string): never { throw new GenericCmsServiceError(code, 409); }
function currentPayload(item: GenericCmsView): Record<string, unknown> {
  return { ...item.payload };
}
function editorial(item: GenericCmsView) {
  return {
    reviewStatus: item.payload.reviewStatus,
    sourceReferences: item.payload.sourceReferences,
  };
}
async function validatedSources(item: GenericCmsView): Promise<void> {
  const { sourceReferences } = editorial(item);
  if (!Array.isArray(sourceReferences) || sourceReferences.length === 0 ||
      !sourceReferences.every((s) => typeof s === "string" && s.trim().length > 0) ||
      new Set(sourceReferences).size !== sourceReferences.length) reject("FAQ_SOURCE_REFERENCES_REQUIRED");
  if (typeof item.payload.answer !== "string" || item.payload.answer.trim().length < 10) reject("FAQ_ANSWER_REQUIRED");
  const index = await loadIndex(false);
  const available = new Set(index.procedures.map((p) => p.id));
  if (!sourceReferences.every((id) => available.has(id))) reject("FAQ_SOURCE_NOT_FOUND");
}
function version(body: unknown): number { return versionSchema.parse(body).expectedVersion; }
function matchVersion(item: GenericCmsView, expected: number): void {
  if (Number(item.version) !== expected) reject("FAQ_REVISION_CONFLICT");
}
async function getOrFail(id: string): Promise<GenericCmsView> {
  const item = await faqService.get(id);
  if (!item) throw new GenericCmsServiceError("CMS_ITEM_NOT_FOUND", 404);
  return item;
}
async function mutate(
  request: FastifyRequest, item: GenericCmsView, action: string,
  patch: { payload?: Record<string, unknown>; status?: "DRAFT" | "REVIEW_READY" | "PUBLISHED" | "UNPUBLISHED"; title?: string },
  expectedVersion: number,
) {
  matchVersion(item, expectedVersion);
  const after = await updateFaqAtomic(request, {
    publicId: item.id, expectedVersion, action, patch,
  });
  return { ok: true, item: after };
}
function sendFailure(error: unknown, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ ok: false, error: "FAQ_VALIDATION_FAILED", issues: error.issues });
  }
  if (error instanceof GenericCmsServiceError) {
    return reply.code(error.statusCode).send({ ok: false, error: error.code, ...(error.currentVersion ? { currentVersion: error.currentVersion } : {}) });
  }
  throw error;
}
async function run(reply: FastifyReply, task: () => Promise<unknown>) {
  try { return await task(); } catch (error) { return sendFailure(error, reply); }
}
function identifier(request: FastifyRequest): string {
  const id = (request.params as { id?: string }).id;
  return sourceId.parse(id);
}
export function registerFaqCmsRoutes(app: FastifyInstance): void {
  const base = "/api/admin/cms/faqs";
  app.get(base, policy("cms.read"), async (request, reply) =>
    run(reply, async () => ({ ok: true, domain: "faqs", ...(await faqService.list((request.query || {}) as Record<string, unknown>)) })));
  app.get(`${base}/:id`, policy("cms.read"), async (request, reply) =>
    run(reply, async () => ({ ok: true, item: await getOrFail(identifier(request)) })));
  app.get(`${base}/:id/versions`, policy("cms.version.read"), async (request, reply) =>
    run(reply, async () => ({ ok: true, versions: await faqService.versions(identifier(request)) })));
  app.get(`${base}/:id/audit`, policy("cms.audit.read"), async (request, reply) =>
    run(reply, async () => ({ ok: true, events: await faqService.audit(identifier(request)) })));

  app.post(base, policy("cms.create"), async (request, reply) => run(reply, async () => {
    const input = createSchema.parse(request.body);
    const payload: Record<string, unknown> = {
      ...input.payload, latestRank: null, trendingRank: null, reviewStatus: "pending",
    };
    const item = await createFaqAtomic(request, { publicId: input.publicId, title: input.title, payload });
    return reply.code(201).send({ ok: true, item });
  }));

  app.patch(`${base}/:id`, policy("cms.edit"), async (request, reply) => run(reply, async () => {
    const input = editSchema.parse(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "DRAFT") reject("FAQ_EDIT_REQUIRES_DRAFT");
    const old = currentPayload(item);
    const changed: FaqEditable = payloadSchema.parse({
      answer: old.answer, category: old.category, tags: old.tags,
      sourceReferences: old.sourceReferences, ...(input.payload || {}),
    });
    return mutate(request, item, "edited", {
      ...(input.title ? { title: input.title } : {}),
      payload: { ...changed, latestRank: null, trendingRank: null, reviewStatus: "pending" },
    }, input.expectedVersion);
  }));

  app.post(`${base}/:id/actions/submit-review`, policy("cms.edit"), async (request, reply) => run(reply, async () => {
    const expected = version(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "DRAFT") reject("FAQ_REVIEW_REQUIRES_DRAFT");
    await validatedSources(item);
    return mutate(request, item, "review_submitted", {
      status: "REVIEW_READY", payload: { ...currentPayload(item), reviewStatus: "submitted", reviewNotes: null, reviewedBy: null, reviewedAt: null },
    }, expected);
  }));

  app.post(`${base}/:id/actions/approve`, policy("cms.publish"), async (request, reply) => run(reply, async () => {
    const expected = version(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "REVIEW_READY" || item.payload.reviewStatus !== "submitted") reject("FAQ_NOT_AWAITING_REVIEW");
    await validatedSources(item);
    return mutate(request, item, "approved", {
      payload: { ...currentPayload(item), reviewStatus: "approved", reviewedBy: actor(request), reviewedAt: new Date().toISOString() },
    }, expected);
  }));

  app.post(`${base}/:id/actions/reject`, policy("cms.publish"), async (request, reply) => run(reply, async () => {
    const input = rejectSchema.parse(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "REVIEW_READY" || item.payload.reviewStatus !== "submitted") reject("FAQ_NOT_AWAITING_REVIEW");
    return mutate(request, item, "rejected", {
      status: "DRAFT", payload: { ...currentPayload(item), reviewStatus: "rejected", reviewNotes: input.reason, reviewedBy: actor(request), reviewedAt: new Date().toISOString() },
    }, input.expectedVersion);
  }));

  app.post(`${base}/:id/actions/publish`, policy("cms.publish"), async (request, reply) => run(reply, async () => {
    const expected = version(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "REVIEW_READY" || item.payload.reviewStatus !== "approved" ||
        !item.payload.reviewedBy || !item.payload.reviewedAt) reject("FAQ_APPROVAL_REQUIRED");
    await validatedSources(item);
    return mutate(request, item, "published", { status: "PUBLISHED" }, expected);
  }));

  app.post(`${base}/:id/actions/unpublish`, policy("cms.unpublish"), async (request, reply) => run(reply, async () => {
    const expected = version(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "PUBLISHED") reject("FAQ_NOT_PUBLISHED");
    return mutate(request, item, "unpublished", { status: "UNPUBLISHED", payload: { ...currentPayload(item), latestRank: null, trendingRank: null } }, expected);
  }));

  app.post(`${base}/:id/actions/reopen`, policy("cms.edit"), async (request, reply) => run(reply, async () => {
    const expected = version(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "UNPUBLISHED") reject("FAQ_REOPEN_REQUIRES_UNPUBLISHED");
    return mutate(request, item, "reopened", { status: "DRAFT", payload: { ...currentPayload(item),
      reviewStatus: "pending", reviewedBy: null, reviewedAt: null, latestRank: null, trendingRank: null,
    } }, expected);
  }));

  app.patch(`${base}/:id/ranking`, policy("cms.edit"), async (request, reply) => run(reply, async () => {
    const input = rankSchema.parse(request.body), item = await getOrFail(identifier(request));
    if (item.status !== "PUBLISHED") reject("FAQ_RANKING_REQUIRES_PUBLISHED");
    const { expectedVersion, ...ranking } = input;
    return mutate(request, item, "ranking_updated", { payload: { ...currentPayload(item), ...ranking } }, expectedVersion);
  }));
}
