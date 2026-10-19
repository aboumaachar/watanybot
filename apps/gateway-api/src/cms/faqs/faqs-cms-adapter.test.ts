import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  create: vi.fn(), get: vi.fn(), list: vi.fn(), update: vi.fn(),
  transition: vi.fn(), restore: vi.fn(), bulk: vi.fn(),
  relationships: vi.fn(), addRelationship: vi.fn(),
  deleteRelationship: vi.fn(), replaceRelationships: vi.fn(),
  versions: vi.fn(), audit: vi.fn(), appendAudit: vi.fn(), createVersion: vi.fn(),
  loadIndex: vi.fn(),
}));
vi.mock("../storage/genericCmsRepository.js", () => ({
  createGenericCmsEntity: mocks.create, getGenericCmsEntity: mocks.get,
  listGenericCmsEntitiesPage: mocks.list, updateGenericCmsEntity: mocks.update,
  transitionGenericCmsEntity: mocks.transition, restoreGenericCmsEntity: mocks.restore,
  bulkUpdateGenericCmsEntities: mocks.bulk, listGenericCmsRelationships: mocks.relationships,
  createGenericCmsRelationship: mocks.addRelationship, deleteGenericCmsRelationship: mocks.deleteRelationship,
  replaceGenericCmsRelationships: mocks.replaceRelationships,
}));
vi.mock("../../procedures/indexer.js", () => ({ loadIndex: mocks.loadIndex }));
vi.mock("../../admin-authority/adminAuthorityAudit.js", () => ({
  appendAdminAuditEvent: mocks.appendAudit, createAdminAuditEvent: (input: unknown) => input,
  listRecentAdminAuditEvents: mocks.audit,
}));
vi.mock("../../admin-authority/adminAuthorityVersioning.js", () => ({
  createAdminEntityVersion: mocks.createVersion, listAdminEntityVersions: mocks.versions,
}));
vi.mock("./faqs-transaction.js", () => {
  const FAQ_CMS_CONFIG = {
    domain: "faqs", entityType: "cms.faqs", auditEntityType: "faq",
    title: "FAQ and question curation", defaultLocale: "ar",
    allowedPayloadKeys: [
      "answer", "category", "tags", "sourceReferences",
      "latestRank", "trendingRank", "reviewStatus", "reviewNotes", "reviewedBy", "reviewedAt",
    ],
  };
  const view = (entity: any) => ({
    id: entity.publicId, domain: entity.domain, publicId: entity.publicId,
    publicCode: entity.publicCode, sourceId: entity.sourceId,
    title: entity.title, status: entity.status, version: String(entity.revision),
    createdAt: entity.createdAt, updatedAt: entity.updatedAt,
    publishedAt: entity.publishedAt, archivedAt: entity.archivedAt,
    payload: entity.payload, sourceMeta: entity.sourceMeta,
    record: { title: entity.title, ...entity.payload },
  });
  const record = async () => {
    await mocks.createVersion();
    await mocks.appendAudit();
  };
  return {
    FAQ_CMS_CONFIG,
    createFaqAtomic: async (_req: unknown, input: any) => {
      const entity = await mocks.create({ ...input, domain: "faqs", status: "DRAFT" });
      await record();
      return view(entity);
    },
    updateFaqAtomic: async (_req: unknown, input: any) => {
      const before = await mocks.get("faqs", input.publicId);
      if (!before) throw new Error("CMS_ITEM_NOT_FOUND");
      const entity = await mocks.update("faqs", input.publicId,
        { ...input.patch, updatedBy: "sa1", expectedRevision: input.expectedVersion });
      await record();
      return view(entity);
    },
  };
});
import { registerFaqCmsRoutes } from "./faqs-cms-adapter.js";

const h = { "x-test-role": "superadmin" };
const make = (partial: Record<string, unknown> = {}) => ({
  id: "entity-1", domain: "faqs", publicId: "FAQ-1", publicCode: null,
  sourceId: null, status: "DRAFT", locale: "ar", title: "ما إجراءات الطلب؟",
  payload: { answer: "هذه إجابة موثقة للإجراءات الرسمية.", category: "إجراءات", tags: [], sourceReferences: ["PROC-1"],
    latestRank: null, trendingRank: null, reviewStatus: "pending", reviewedAt: null, reviewedBy: null },
  sourceMeta: {}, revision: 1, createdBy: "sa1", updatedBy: "sa1",
  createdAt: "2026-10-08T00:00:00.000Z", updatedAt: "2026-10-08T00:00:00.000Z",
  publishedAt: null, archivedAt: null, ...partial,
});
let state: ReturnType<typeof make> | null;
async function buildApp() {
  const app = Fastify();
  app.addHook("onRequest", async (req) => {
    const role = req.headers["x-test-role"];
    if (role === "admin" || role === "superadmin") {
      (req as any).user = { id: "sa1", role, email: "staff@watany.test" };
    }
  });
  registerFaqCmsRoutes(app);
  await app.ready();
  return app;
}
const path = "/api/admin/cms/faqs";
function send(app: Awaited<ReturnType<typeof buildApp>>, method: "GET" | "POST" | "PATCH", suffix: string, payload?: unknown, headers: Record<string, string> = h) {
  return app.inject({ method, url: path + suffix, headers, ...(payload === undefined ? {} : { payload: payload as Record<string, unknown> }) });
}

describe("R-025 FAQ guarded workflow — no DB or public FAQ mutation", () => {
  beforeEach(() => {
    for (const fn of Object.values(mocks)) fn.mockReset();
    state = null;
    mocks.loadIndex.mockResolvedValue({ procedures: [{ id: "PROC-1" }, { id: "PROC-2" }] });
    mocks.create.mockImplementation(async (input) => { state = make({
      publicId: input.publicId, title: input.title, payload: input.payload,
      status: input.status, revision: 1,
    }); return state; });
    mocks.get.mockImplementation(async (_domain, id) => state?.publicId === id ? state : null);
    mocks.list.mockImplementation(async () => ({
      items: state ? [state] : [], total: state ? 1 : 0, page: 1, pageSize: 20,
      statusCounts: { DRAFT: 0, REVIEW_READY: 0, PUBLISHED: 0, UNPUBLISHED: 0, ARCHIVED: 0 },
    }));
    mocks.update.mockImplementation(async (_domain, id, patch) => {
      if (!state || id !== state.publicId) return null;
      if (patch.expectedRevision && patch.expectedRevision !== state.revision) {
        const e = Object.assign(new Error("CMS_REVISION_CONFLICT"), { code: "CMS_REVISION_CONFLICT", currentRevision: state.revision }); throw e;
      }
      state = { ...state, ...patch, status: patch.status || state.status,
        payload: patch.payload || state.payload, revision: state.revision + 1 };
      return state;
    });
    mocks.audit.mockResolvedValue([]);
    mocks.versions.mockResolvedValue([]);
    mocks.createVersion.mockResolvedValue(undefined);
    mocks.appendAudit.mockResolvedValue(undefined);
  });

  it("rejects anonymous read and admin write while permitting admin read", async () => {
    const app = await buildApp();
    expect((await send(app, "GET", "", undefined, {})).statusCode).toBe(401);
    expect((await send(app, "GET", "", undefined, { "x-test-role": "admin" })).statusCode).toBe(200);
    expect((await send(app, "POST", "", { publicId: "FAQ-1", title: "سؤال" }, { "x-test-role": "admin" })).statusCode).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
    await app.close();
  });

  it("cannot create published/approved/ranked entries or bypass via generic mutation routes", async () => {
    const app = await buildApp();
    for (const body of [
      { publicId: "FAQ-1", title: "سؤال", status: "PUBLISHED" },
      { publicId: "FAQ-1", title: "سؤال", payload: { reviewStatus: "approved" } },
      { publicId: "FAQ-1", title: "سؤال", payload: { latestRank: 1 } },
    ]) expect((await send(app, "POST", "", body)).statusCode).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
    expect((await send(app, "POST", "/FAQ-1/actions/restore", {})).statusCode).toBe(404);
    expect((await send(app, "POST", "/bulk-actions/edit", { ids: ["FAQ-1"] })).statusCode).toBe(404);
    await app.close();
  });

  it("rejects missing/unknown source and unreviewed publication", async () => {
    const app = await buildApp();
    expect((await send(app, "POST", "", { publicId: "FAQ-1", title: "سؤال", payload: { answer: "إجابة تجريبية كاملة" } })).statusCode).toBe(201);
    expect((await send(app, "POST", "/FAQ-1/actions/submit-review", { expectedVersion: 1 })).json().error).toBe("FAQ_SOURCE_REFERENCES_REQUIRED");
    expect((await send(app, "POST", "/FAQ-1/actions/publish", { expectedVersion: 1 })).json().error).toBe("FAQ_APPROVAL_REQUIRED");
    const e = await send(app, "PATCH", "/FAQ-1", { expectedVersion: 1, payload: { sourceReferences: ["UNKNOWN"] } });
    expect(e.statusCode).toBe(200);
    expect(e.json().item.payload.answer).toBe("إجابة تجريبية كاملة");
    expect((await send(app, "POST", "/FAQ-1/actions/submit-review", { expectedVersion: 2 })).json().error).toBe("FAQ_SOURCE_NOT_FOUND");
    expect(mocks.loadIndex).toHaveBeenCalled();
    expect(state?.status).toBe("DRAFT");
    await app.close();
  });

  it("enforces submit, approve, publish, rank, unpublish, reopen and audit", async () => {
    const app = await buildApp();
    const created = await send(app, "POST", "", { publicId: "FAQ-1", title: "سؤال", payload: { answer: "إجابة رسمية مستندة للمصدر", sourceReferences: ["PROC-1"] } });
    expect(created.statusCode).toBe(201);
    expect(created.json().item.status).toBe("DRAFT");
    expect((await send(app, "POST", "/FAQ-1/actions/approve", { expectedVersion: 1 })).statusCode).toBe(409);
    expect((await send(app, "POST", "/FAQ-1/actions/submit-review", { expectedVersion: 1 })).json().item.status).toBe("REVIEW_READY");
    expect((await send(app, "PATCH", "/FAQ-1", { expectedVersion: 2, title: "edit bypass" })).statusCode).toBe(409);
    expect((await send(app, "POST", "/FAQ-1/actions/publish", { expectedVersion: 2 })).statusCode).toBe(409);
    expect((await send(app, "POST", "/FAQ-1/actions/approve", { expectedVersion: 2 })).json().item.payload.reviewStatus).toBe("approved");
    expect((await send(app, "POST", "/FAQ-1/actions/publish", { expectedVersion: 3 })).json().item.status).toBe("PUBLISHED");
    expect((await send(app, "PATCH", "/FAQ-1/ranking", { expectedVersion: 4, latestRank: 3, trendingRank: 1 })).json().item.payload.latestRank).toBe(3);
    expect((await send(app, "POST", "/FAQ-1/actions/unpublish", { expectedVersion: 5 })).json().item.payload.trendingRank).toBeNull();
    expect((await send(app, "POST", "/FAQ-1/actions/reopen", { expectedVersion: 6 })).json().item.payload.reviewStatus).toBe("pending");
    expect(state?.status).toBe("DRAFT");
    expect(mocks.createVersion).toHaveBeenCalledTimes(7);
    expect(mocks.appendAudit).toHaveBeenCalledTimes(7);
    await app.close();
  });

  it("rejects stale revisions and records rejected review as a draft", async () => {
    const app = await buildApp();
    await send(app, "POST", "", { publicId: "FAQ-1", title: "سؤال", payload: { answer: "إجابة رسمية مستندة للمصدر", sourceReferences: ["PROC-1"] } });
    expect((await send(app, "PATCH", "/FAQ-1", { expectedVersion: 3, title: "stale" })).statusCode).toBe(409);
    await send(app, "POST", "/FAQ-1/actions/submit-review", { expectedVersion: 1 });
    expect((await send(app, "POST", "/FAQ-1/actions/reject", { expectedVersion: 2, reason: "Missing supporting evidence" })).json().item.payload.reviewStatus).toBe("rejected");
    expect(state?.status).toBe("DRAFT");
    expect((await send(app, "POST", "/FAQ-1/actions/publish", { expectedVersion: 3 })).statusCode).toBe(409);
    await app.close();
  });
});
