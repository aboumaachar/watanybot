/**
 * Admin Authority Routes
 * Implements the read-only dashboard summary endpoints required by the
 * Superadmin CRM Command Center spec (VS_CODE_FINALIZE_SUPERADMIN_DASHBOARD.md § 10).
 *
 * Routes:
 *   GET /api/admin-authority/me
 *   GET /api/admin-authority/permissions
 *   GET /api/admin-authority/dashboard/summary
 *   GET /api/admin-authority/audit-events
 *   GET /api/admin-authority/approval-requests
 *   GET /api/admin-authority/integration-status
 *   GET /api/admin-authority/module-health
 *
 * All routes require superadmin role (resolved from request.user set by auth middleware).
 */
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { request } from 'undici';
import { requireRole } from '../auth/rbac.js';
import { aiBaseUrl, getPythonBase, useAi, usePython } from '../lib/config.js';
import { getAiChat, getAiModel, getAiProvider } from '../bootstrap/ai-state.js';
import { buildAdminIntegrationStatuses, type IntegrationHealthSignal } from './integrationStatus.js';
import {
  DEFAULT_ADMIN_ROUTE_POLICIES,
  evaluateAdminAuthority,
  getRoutePolicyByKey,
  resolveAdminActorFromRequest,
} from './adminAuthorityGuard.js';
import {
  appendAdminAuditEvent,
  createAdminAuditEvent,
  listRecentAdminAuditEvents,
} from './adminAuthorityAudit.js';
import {
  createAdminApprovalRequest,
  decideAdminApprovalRequest,
  listPendingAdminApprovalRequests,
} from './adminAuthorityApproval.js';
import {
  createAdminEntityVersion,
  listAdminEntityVersions,
} from './adminAuthorityVersioning.js';
const guardSuperadmin = { preHandler: [requireRole('superadmin')] };

// ── Module health catalog ──────────────────────────────────────────────────
// Each module maps to a known gate status based on what's been proven so far.
const MODULE_CATALOG = [
  { id: 'auth',           title: 'Auth / JWT',           evidenceStatus: 'proven'    as const },
  { id: 'rbac',           title: 'RBAC / Roles',         evidenceStatus: 'proven'    as const },
  { id: 'users',          title: 'Users / Sessions',     evidenceStatus: 'candidate' as const },
  { id: 'audit',          title: 'Audit Logs',           evidenceStatus: 'proven'    as const, note: 'PostgreSQL-backed immutable audit stream' },
  { id: 'approvals',      title: 'Approval Center',      evidenceStatus: 'proven'    as const, note: 'PostgreSQL-backed approval queue' },
  { id: 'versioning',     title: 'Entity Versioning',    evidenceStatus: 'proven'    as const, note: 'PostgreSQL-backed entity snapshots' },
  { id: 'kb_studio',      title: 'KB Studio',            evidenceStatus: 'missing'   as const },
  { id: 'documents',      title: 'Documents / Procedures', evidenceStatus: 'missing' as const },
  { id: 'payments',       title: 'Payment Intelligence', evidenceStatus: 'candidate' as const },
  { id: 'salary',         title: 'Salary / Pension',     evidenceStatus: 'candidate' as const },
  { id: 'chatbot',        title: 'Chatbot Review',       evidenceStatus: 'missing'   as const },
  { id: 'integrations',   title: 'SMS/OTP/WhatsApp/Voice', evidenceStatus: 'missing' as const },
  { id: 'deployment',     title: 'Deployment Health',    evidenceStatus: 'candidate' as const },
  { id: 'analytics',      title: 'Analytics',            evidenceStatus: 'missing'   as const },
  { id: 'crm_cases',      title: 'CRM Cases',            evidenceStatus: 'missing'   as const },
] as const;

const MODULE_MUTATION_POLICY_KEY: Record<string, string> = {
  users: 'admin.users.manage',
  rbac: 'admin.roles.manage',
  payments: 'admin.payments.override',
  salary: 'admin.salary.manage_formula',
  kb_studio: 'admin.kb.publish',
  documents: 'admin.documents.publish',
  deployment: 'admin.deployment.operate',
};

function getPolicyForModule(moduleId: string) {
  const policyKey = MODULE_MUTATION_POLICY_KEY[moduleId];
  if (!policyKey) return null;
  try {
    return getRoutePolicyByKey(policyKey);
  } catch {
    return null;
  }
}

type EvidenceStatus = 'proven' | 'candidate' | 'missing' | 'blocked';

function evidenceToWidgetStatus(ev: EvidenceStatus): 'ready' | 'warning' | 'blocked' | 'pending' | 'unknown' {
  if (ev === 'proven') return 'ready';
  if (ev === 'candidate') return 'pending';
  if (ev === 'missing') return 'blocked';
  return 'unknown';
}

async function probeLegacyPythonHealth(): Promise<IntegrationHealthSignal | undefined> {
  if (!usePython) return undefined;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);
  const started = Date.now();
  try {
    const response = await request(`${getPythonBase()}/health`, { method: 'GET', signal: controller.signal });
    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      statusCode: response.statusCode,
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return { ok: false, latencyMs: Date.now() - started, error: error instanceof Error ? error.message : 'legacy python health check failed' };
  } finally {
    clearTimeout(timeout);
  }
}

async function probePrimaryAiHealth(): Promise<IntegrationHealthSignal | undefined> {
  if (!useAi) return undefined;
  const aiChat = getAiChat();
  if (!aiChat) return undefined;
  try {
    const health = await aiChat.healthCheck();
    return { ok: health.ok, latencyMs: health.latencyMs };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'AI provider health check failed' };
  }
}

// ── Route registration ─────────────────────────────────────────────────────
export async function adminAuthorityRoutes(app: FastifyInstance): Promise<void> {

  /**
   * GET /api/admin-authority/me
   * Returns the actor identity and resolved roles/permissions for the current JWT.
   */
  app.get('/admin-authority/me', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user;
    if (!user) {
      return reply.code(401).send({ ok: false, error: 'Not authenticated' });
    }
    const actor = resolveAdminActorFromRequest(request);
    return reply.send({
      ok: true,
      authority: {
        authenticated: true,
        actorId: user.id,
        email: user.email,
        roles: [user.role],
        isSuperadmin: user.role === 'superadmin',
        permissions: actor?.permissions ?? [],
      },
    });
  });

  /**
   * GET /api/admin-authority/permissions
   * Returns all registered admin route policies (permission registry).
   */
  app.get('/admin-authority/permissions', guardSuperadmin, async (_req: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      ok: true,
      policies: DEFAULT_ADMIN_ROUTE_POLICIES.map((p) => ({
        key: p.key,
        method: p.method,
        path: p.path,
        requiredPermission: p.requiredPermission,
        sensitive: p.sensitive ?? false,
        requiresApproval: p.approvalRequired ?? false,
        writesAudit: !!p.auditEvent,
        versioned: p.versioned ?? false,
      })),
      count: DEFAULT_ADMIN_ROUTE_POLICIES.length,
    });
  });

  /**
   * GET /api/admin-authority/dashboard/summary
   * Returns the full SuperadminDashboardSummary shape consumed by the frontend.
   */
  app.get('/admin-authority/dashboard/summary', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user!;
    const actor = resolveAdminActorFromRequest(request);
    const auditEvents = await listRecentAdminAuditEvents(50);
    const pendingApprovals = await listPendingAdminApprovalRequests(50);

    const modules = MODULE_CATALOG.map((m) => ({
      id: m.id,
      title: m.title,
      status: evidenceToWidgetStatus(m.evidenceStatus),
      evidenceStatus: m.evidenceStatus,
      note: 'note' in m ? (m as any).note : undefined,
      metrics: [] as Array<{ label: string; value: string | number }>,
      actions: DEFAULT_ADMIN_ROUTE_POLICIES
        .filter((p) => p.key.startsWith(`admin.${m.id}`))
        .map((p) => ({
          id: p.key,
          label: p.auditEvent ?? p.key,
          permission: p.requiredPermission,
          enabled: true,
          disabledReason: undefined,
        })),
    }));

    const summary = {
      authority: {
        authenticated: true,
        actorId: user.id,
        roles: [user.role],
        permissions: actor?.permissions ?? [],
      },
      modules,
      audit: {
        recentCount: auditEvents.length,
        pendingApprovalCount: pendingApprovals.length,
        failedActionCount: auditEvents.filter((e) => e.eventType.endsWith('.failed')).length,
      },
      generatedAt: new Date().toISOString(),
    };

    return reply.send({ ok: true, summary });
  });

  /**
   * GET /api/admin-authority/audit-events
   * Returns recent audit events (in-memory; DB backing is a P1 migration).
   */
  app.get('/admin-authority/audit-events', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const qs = request.query as { limit?: string };
    const limit = Math.min(Number(qs.limit || 50), 200);
    const events = await listRecentAdminAuditEvents(limit);
    return reply.send({ ok: true, count: events.length, events });
  });

  /**
   * GET /api/admin-authority/approval-requests
   * Returns pending approval requests (in-memory; DB backing is a P1 migration).
   */
  app.get('/admin-authority/approval-requests', guardSuperadmin, async (_req: FastifyRequest, reply: FastifyReply) => {
    const approvals = await listPendingAdminApprovalRequests(50);
    return reply.send({ ok: true, count: approvals.length, approvals });
  });

  /**
   * GET /api/admin-authority/integration-status
   * Returns integration module health signals.
   */
  app.get('/admin-authority/integration-status', guardSuperadmin, async (_req: FastifyRequest, reply: FastifyReply) => {
    const [pythonHealth, aiHealth] = await Promise.all([
      probeLegacyPythonHealth(),
      probePrimaryAiHealth(),
    ]);
    const integrations = buildAdminIntegrationStatuses({
      env: process.env,
      usePython,
      pythonBase: getPythonBase(),
      pythonHealth,
      useAi,
      aiBaseUrl,
      aiProvider: getAiProvider(),
      aiModel: getAiModel(),
      aiHealth,
      gatewayUrl: process.env.API_BASE_URL ?? '',
    });
    return reply.send({ ok: true, integrations });
  });

  /**
   * POST /api/admin-authority/modules/:moduleId/mutations
   * Creates approval-gated mutation workflows for admin modules.
   */
  app.post('/admin-authority/modules/:moduleId/mutations', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const { moduleId } = request.params as { moduleId: string };
    const body = (request.body || {}) as {
      entityId?: string;
      reason?: string;
      snapshot?: unknown;
      payload?: unknown;
    };

    const policy = getPolicyForModule(moduleId);
    if (!policy) {
      return reply.code(404).send({ ok: false, error: 'MODULE_MUTATION_POLICY_NOT_FOUND', moduleId });
    }

    const decision = evaluateAdminAuthority(request, policy);
    if (!decision.allowed) {
      return reply.code(decision.statusCode).send({
        ok: false,
        error: decision.reason,
        requiredPermission: decision.requiredPermission,
      });
    }

    const actorId = String(decision.actorId || request.user?.id || 'unknown_admin');
    const entityId = String(body.entityId || `${moduleId}-mutation`);
    const reason = String(body.reason || 'Module-level mutation workflow request');

    const approval = await createAdminApprovalRequest({
      actionType: policy.key,
      requestedBy: actorId,
      entityType: moduleId,
      entityId,
      reason,
    });

    const version = await createAdminEntityVersion({
      entityType: moduleId,
      entityId,
      snapshot: body.snapshot ?? body.payload ?? { moduleId, entityId, requestedBy: actorId },
      createdBy: actorId,
      reason,
    });

    const audit = await appendAdminAuditEvent(createAdminAuditEvent({
      eventType: policy.auditEvent ?? `${policy.key}.requested`,
      actorId,
      entityType: moduleId,
      entityId,
      before: null,
      after: {
        policyKey: policy.key,
        approvalId: approval.id,
        versionId: version.id,
      },
      reason,
      approvalId: approval.id,
      requestId: request.id ? String(request.id) : undefined,
      ip: request.ip ? String(request.ip) : undefined,
      userAgent: request.headers?.['user-agent'] ? String(request.headers['user-agent']) : undefined,
    }));

    return reply.send({
      ok: true,
      workflow: {
        moduleId,
        policyKey: policy.key,
        approvalId: approval.id,
        versionId: version.id,
        auditEventId: audit.id,
        status: approval.status,
      },
    });
  });

  /**
   * GET /api/admin-authority/modules/:moduleId/approval-requests
   * Returns pending approval requests for the module policy namespace.
   */
  app.get('/admin-authority/modules/:moduleId/approval-requests', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const { moduleId } = request.params as { moduleId: string };
    const policy = getPolicyForModule(moduleId);
    if (!policy) {
      return reply.code(404).send({ ok: false, error: 'MODULE_MUTATION_POLICY_NOT_FOUND', moduleId });
    }

    const approvals = await listPendingAdminApprovalRequests(50, policy.key);
    return reply.send({ ok: true, moduleId, count: approvals.length, approvals });
  });

  /**
   * POST /api/admin-authority/approval-requests/:approvalId/decision
   * Applies an approval gate decision (approve/reject/cancel).
   */
  app.post('/admin-authority/approval-requests/:approvalId/decision', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const { approvalId } = request.params as { approvalId: string };
    const body = (request.body || {}) as { decision?: 'approved' | 'rejected' | 'cancelled'; note?: string };

    const decision = body.decision;
    if (decision !== 'approved' && decision !== 'rejected' && decision !== 'cancelled') {
      return reply.code(400).send({ ok: false, error: 'INVALID_APPROVAL_DECISION' });
    }

    const actorId = String(request.user?.id || 'unknown_admin');
    const decided = await decideAdminApprovalRequest({
      approvalId,
      actorId,
      decision,
      decisionNote: body.note,
    });

    if (!decided) {
      return reply.code(404).send({ ok: false, error: 'APPROVAL_NOT_FOUND_OR_ALREADY_DECIDED' });
    }

    await appendAdminAuditEvent(createAdminAuditEvent({
      eventType: `admin.approval.${decision}`,
      actorId,
      entityType: decided.entityType,
      entityId: decided.entityId,
      before: { status: 'pending' },
      after: { status: decided.status, approvalId: decided.id },
      reason: body.note || `Approval ${decision}`,
      approvalId: decided.id,
      requestId: request.id ? String(request.id) : undefined,
      ip: request.ip ? String(request.ip) : undefined,
      userAgent: request.headers?.['user-agent'] ? String(request.headers['user-agent']) : undefined,
    }));

    return reply.send({ ok: true, approval: decided });
  });

  /**
   * GET /api/admin-authority/modules/:moduleId/versions/:entityId
   * Returns entity version chain for module-level workflows.
   */
  app.get('/admin-authority/modules/:moduleId/versions/:entityId', guardSuperadmin, async (request: FastifyRequest, reply: FastifyReply) => {
    const { moduleId, entityId } = request.params as { moduleId: string; entityId: string };
    const versions = await listAdminEntityVersions(moduleId, entityId);
    return reply.send({ ok: true, moduleId, entityId, count: versions.length, versions });
  });

  /**
   * GET /api/admin-authority/module-health
   * Returns per-module health/evidence status.
   */
  app.get('/admin-authority/module-health', guardSuperadmin, async (_req: FastifyRequest, reply: FastifyReply) => {
    const modules = MODULE_CATALOG.map((m) => ({
      id: m.id,
      title: m.title,
      status: evidenceToWidgetStatus(m.evidenceStatus),
      evidenceStatus: m.evidenceStatus,
      checkedAt: new Date().toISOString(),
    }));
    return reply.send({ ok: true, modules });
  });
}

export default adminAuthorityRoutes;
