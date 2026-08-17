import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireRole } from "../auth/rbac.js";
import { ErpNextClient, ErpNextRequestError, type ErpNextContact } from "../integrations/erpnext/client.js";
import { appendAdminAuditEvent, createAdminAuditEvent } from "../admin-authority/adminAuthorityAudit.js";

const PHASE7_CANARY_PREFIX = "APEX-P7-V103-CANARY-";
const PHASE8_CANARY_PREFIX = "APEX-P8-FINAL-CANARY-";
const client = new ErpNextClient();
const superadminOnly = { preHandler: [requireRole("superadmin")] };

function isCanary(contact: ErpNextContact): boolean {
  return typeof contact.first_name === "string" && [PHASE7_CANARY_PREFIX, PHASE8_CANARY_PREFIX].some((prefix) => contact.first_name?.startsWith(prefix));
}

function canaryNamespace(contact: ErpNextContact): string {
  return contact.first_name?.startsWith(PHASE8_CANARY_PREFIX) ? "PHASE8_OWNED" : "PHASE7_OWNED";
}

async function writeAudit(request: FastifyRequest, eventType: string, contact: ErpNextContact, outcome: string, runId: string, before?: unknown): Promise<void> {
  await appendAdminAuditEvent(createAdminAuditEvent({
    eventType,
    actorId: request.user?.id || "unknown",
    entityType: "ERPNext Contact",
    entityId: contact.name,
    before,
    after: { name: contact.name, first_name: contact.first_name, outcome, runId, canaryNamespace: canaryNamespace(contact) },
    reason: "Phase 7 V1.0.2 synthetic local CRM canary",
    requestId: request.id,
    ip: request.ip,
    userAgent: String(request.headers["user-agent"] || ""),
  }));
}

function handleErpError(reply: FastifyReply, error: unknown) {
  if (error instanceof ErpNextRequestError) {
    return reply.code(error.statusCode).send({ ok: false, error: error.safeCode });
  }
  return reply.code(502).send({ ok: false, error: "erpnext_contact_request_failed" });
}

export async function adminCrmContactsRoutes(app: FastifyInstance): Promise<void> {
  app.get("/admin-authority/crm/contacts", superadminOnly, async (request, reply) => {
    try {
      const query = request.query as { limit?: string };
      const contacts = await client.listContacts(Number(query.limit || 50));
      return reply.send({ ok: true, doctype: "Contact", items: contacts, bounded: true });
    } catch (error) {
      return handleErpError(reply, error);
    }
  });

  app.get<{ Params: { name: string } }>("/admin-authority/crm/contacts/:name", superadminOnly, async (request, reply) => {
    try {
      const contact = await client.getContact(request.params.name);
      return reply.send({ ok: true, doctype: "Contact", item: contact });
    } catch (error) {
      return handleErpError(reply, error);
    }
  });

  app.post<{ Body: { runId?: string; namespace?: string } }>("/admin-authority/crm/contacts/canary", superadminOnly, async (request, reply) => {
    const runId = String(request.body?.runId || randomUUID()).replace(/[^A-Za-z0-9-]/g, "-").slice(0, 32);
    const prefix = request.body?.namespace === "PHASE8" ? PHASE8_CANARY_PREFIX : PHASE7_CANARY_PREFIX;
    const marker = `${prefix}${new Date().toISOString().replace(/[-:.TZ]/g, "")}-${runId}`;
    try {
      const contact = await client.createContact({
        first_name: marker,
        last_name: "LOCAL",
        email_id: `${marker.toLowerCase()}@invalid`,
        company_name: "WatanyBot local integration canary",
      });
      try {
        await writeAudit(request, "crm.contact.canary_created", contact, "created", runId);
      } catch (auditError) {
        try {
          await client.deleteContact(contact.name);
        } catch {
          return reply.code(503).send({ ok: false, error: "audit_persistence_failed_with_residue" });
        }
        throw auditError;
      }
      return reply.code(201).send({ ok: true, doctype: "Contact", item: contact, synthetic: true, marker });
    } catch (error) {
      return handleErpError(reply, error);
    }
  });

  app.patch<{ Params: { name: string }; Body: { status?: string; last_name?: string } }>("/admin-authority/crm/contacts/:name", superadminOnly, async (request, reply) => {
    try {
      const before = await client.getContact(request.params.name);
      if (!isCanary(before)) return reply.code(403).send({ ok: false, error: "synthetic_canary_only" });
      const data: Record<string, unknown> = {};
      if (typeof request.body?.status === "string") data.status = request.body.status.slice(0, 40);
      if (typeof request.body?.last_name === "string") data.last_name = request.body.last_name.slice(0, 80);
      if (Object.keys(data).length === 0) return reply.code(400).send({ ok: false, error: "bounded_update_required" });
      const contact = await client.updateContact(request.params.name, data);
      try {
        await writeAudit(request, "crm.contact.canary_updated", contact, "updated", String(request.headers["x-apex-canary-run-id"] || "unknown"), before);
      } catch (auditError) {
        try {
          await client.updateContact(request.params.name, {
            last_name: before.last_name,
            status: before.status,
          });
        } catch {
          return reply.code(503).send({ ok: false, error: "audit_persistence_failed_with_residue" });
        }
        throw auditError;
      }
      return reply.send({ ok: true, doctype: "Contact", item: contact, synthetic: true });
    } catch (error) {
      return handleErpError(reply, error);
    }
  });

  app.delete<{ Params: { name: string } }>("/admin-authority/crm/contacts/:name", superadminOnly, async (request, reply) => {
    try {
      const contact = await client.getContact(request.params.name);
      if (!isCanary(contact)) return reply.code(403).send({ ok: false, error: "synthetic_canary_only" });
      await writeAudit(request, "crm.contact.canary_deleted", contact, "deleted", String(request.headers["x-apex-canary-run-id"] || "unknown"));
      await client.deleteContact(contact.name);
      return reply.send({ ok: true, deleted: contact.name, synthetic: true });
    } catch (error) {
      return handleErpError(reply, error);
    }
  });
}

export default adminCrmContactsRoutes;