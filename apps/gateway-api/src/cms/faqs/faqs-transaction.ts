import type { FastifyRequest } from "fastify";
import { getClient } from "../../lib/db.js";
import { createAdminAuthorityId, createAdminEntityVersionRowInTransaction, ensureAdminAuthorityTables } from "../../admin-authority/adminAuthorityStore.js";
import { appendAdminAuditEventInTransaction, createAdminAuditEvent } from "../../admin-authority/adminAuthorityAudit.js";
import {
  createGenericCmsEntityInTransaction,
  getGenericCmsEntity,
  updateGenericCmsEntityInTransaction,
  type GenericCmsEntityPatch,
} from "../storage/genericCmsRepository.js";
import { GenericCmsServiceError, toView, type GenericCmsRouteConfig, type GenericCmsView } from "../storage/genericCmsService.js";

export const FAQ_CMS_CONFIG: GenericCmsRouteConfig = {
  domain: "faqs",
  entityType: "cms.faqs",
  auditEntityType: "faq",
  title: "FAQ and question curation",
  defaultLocale: "ar",
  allowedPayloadKeys: [
    "answer", "category", "tags", "sourceReferences",
    "latestRank", "trendingRank", "reviewStatus", "reviewNotes",
    "reviewedBy", "reviewedAt",
  ],
};

type AtomicCreate = { publicId: string; title: string; payload: Record<string, unknown> };
type AtomicUpdate = {
  publicId: string;
  expectedVersion: number;
  action: string;
  patch: Pick<GenericCmsEntityPatch, "title" | "payload" | "status">;
};

type AtomicMutation = { kind: "create"; input: AtomicCreate } | { kind: "update"; input: AtomicUpdate };

function actor(request: FastifyRequest): string {
  const id = request.user?.id;
  if (!id || typeof id !== "string") throw new GenericCmsServiceError("FAQ_ACTOR_REQUIRED", 409);
  return id;
}

/**
 * FAQ-only atomic write owner. No global CMS behavior is changed.
 * Row locks plus revision checks serialize mutation preimages; the CMS row,
 * version snapshot, and audit event either all commit or all roll back.
 */
async function persist(request: FastifyRequest, operation: AtomicMutation): Promise<GenericCmsView> {
  const who = actor(request);
  await ensureAdminAuthorityTables();
  const client = await getClient();
  let connectionBroken = false;
  try {
    await client.query("BEGIN");
    const publicId = operation.input.publicId;
    let before: GenericCmsView | null = null;
    let afterEntity;
    let action: string;

    if (operation.kind === "create") {
      const { title, payload } = operation.input;
      action = "created";
      afterEntity = await createGenericCmsEntityInTransaction(client, {
        domain: FAQ_CMS_CONFIG.domain,
        publicId, title, payload,
        status: "DRAFT", locale: "ar",
        createdBy: who, updatedBy: who,
      });
    } else {
      const { expectedVersion, patch } = operation.input;
      action = operation.input.action;
      // Lock and reload the exact persisted preimage before any change.
      const locked = await client.query(
        "SELECT 1 FROM cms_content_entities WHERE domain = $1 AND public_id = $2 FOR UPDATE",
        [FAQ_CMS_CONFIG.domain, publicId],
      );
      if (!locked.rows.length) throw new GenericCmsServiceError("CMS_ITEM_NOT_FOUND", 404);
      const current = await getGenericCmsEntity(FAQ_CMS_CONFIG.domain, publicId, client);
      if (!current) throw new GenericCmsServiceError("CMS_ITEM_NOT_FOUND", 404);
      if (current.revision !== expectedVersion) {
        throw new GenericCmsServiceError("CMS_REVISION_CONFLICT", 409, "CMS_REVISION_CONFLICT",
          publicId, String(current.revision));
      }
      before = toView(FAQ_CMS_CONFIG, current);
      afterEntity = await updateGenericCmsEntityInTransaction(client, FAQ_CMS_CONFIG.domain, publicId, {
        ...patch, expectedRevision: expectedVersion, updatedBy: who,
      });
      if (!afterEntity) throw new GenericCmsServiceError("CMS_ITEM_NOT_FOUND", 404);
    }

    const after = toView(FAQ_CMS_CONFIG, afterEntity);
    await createAdminEntityVersionRowInTransaction(client, {
      id: createAdminAuthorityId("version"),
      entityType: FAQ_CMS_CONFIG.entityType,
      entityId: publicId,
      snapshot: after,
      createdBy: who,
      reason: action,
    });
    await appendAdminAuditEventInTransaction(client, createAdminAuditEvent({
      eventType: `cms.faqs.${action}`,
      actorId: who,
      entityType: FAQ_CMS_CONFIG.auditEntityType,
      entityId: publicId,
      before,
      after,
      reason: action,
      requestId: request.id,
      ip: request.ip,
      userAgent: request.headers["user-agent"]?.toString(),
    }));
    await client.query("COMMIT");
    return after;
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch (rollbackError) {
      connectionBroken = true;
      const uncertain = new Error("FAQ_TRANSACTION_ROLLBACK_UNCERTAIN") as Error & { primaryError?: unknown; rollbackError?: unknown };
      uncertain.primaryError = error;
      uncertain.rollbackError = rollbackError;
      throw uncertain;
    }
    throw error;
  } finally {
    // Discard an unusable client rather than returning it to the shared pool.
    client.release(connectionBroken ? new Error("FAQ_TRANSACTION_CONNECTION_UNSAFE") : undefined);
  }
}

export function createFaqAtomic(request: FastifyRequest, input: AtomicCreate): Promise<GenericCmsView> {
  return persist(request, { kind: "create", input });
}

export function updateFaqAtomic(request: FastifyRequest, input: AtomicUpdate): Promise<GenericCmsView> {
  return persist(request, { kind: "update", input });
}
