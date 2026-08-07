import { buildAdminAuthorityPreHandler, getRoutePolicyByKey } from './adminAuthorityGuard';
import { appendAdminAuditEvent, createAdminAuditEvent, listRecentAdminAuditEvents } from './adminAuthorityAudit';
import { createAdminApprovalRequest, listPendingAdminApprovalRequests } from './adminAuthorityApproval';
import { createAdminEntityVersion } from './adminAuthorityVersioning';

export async function adminAuthorityProofPlugin(app: any): Promise<void> {
  const viewPolicy = getRoutePolicyByKey('admin.command_center.view');
  const mutatePolicy = getRoutePolicyByKey('admin.payments.override');

  app.get('/admin-authority/proof/view', { preHandler: buildAdminAuthorityPreHandler(viewPolicy) }, async (request: any) => {
    return {
      ok: true,
      proof: 'ADMIN_AUTHORITY_VIEW_ALLOWED',
      actorId: request.adminAuthority?.decision?.actorId ?? null,
      requiredPermission: viewPolicy.requiredPermission,
    };
  });

  app.post('/admin-authority/proof/mutate', { preHandler: buildAdminAuthorityPreHandler(mutatePolicy) }, async (request: any) => {
    const actorId = String(request.adminAuthority?.decision?.actorId ?? 'unknown_admin');
    const approval = await createAdminApprovalRequest({
      actionType: mutatePolicy.key,
      requestedBy: actorId,
      entityType: 'payment_override',
      entityId: 'proof-payment-override',
      reason: 'Phase 1.8 proof route mutation',
    });
    const version = await createAdminEntityVersion({
      entityType: 'payment_override',
      entityId: 'proof-payment-override',
      snapshot: { source: 'phase1.8-proof' },
      createdBy: actorId,
      reason: 'Phase 1.8 proof route mutation',
    });
    const auditEvent = await appendAdminAuditEvent(createAdminAuditEvent({
      eventType: mutatePolicy.auditEvent ?? 'admin.mutation',
      actorId,
      entityType: 'payment_override',
      entityId: 'proof-payment-override',
      after: { approvalId: approval.id, versionId: version.id },
      reason: 'Phase 1.8 proof route mutation',
      approvalId: approval.id,
      requestId: request.id ? String(request.id) : undefined,
      ip: request.ip ? String(request.ip) : undefined,
      userAgent: request.headers?.['user-agent'] ? String(request.headers['user-agent']) : undefined,
    }));

    return {
      ok: true,
      proof: 'ADMIN_AUTHORITY_MUTATION_REQUIRES_AUTH_AND_WRITES_AUDIT_APPROVAL_VERSION',
      approvalId: approval.id,
      versionId: version.id,
      auditEventId: auditEvent.id,
    };
  });

  app.get('/admin-authority/proof/audit-events', { preHandler: buildAdminAuthorityPreHandler(viewPolicy) }, async () => {
    return { ok: true, events: await listRecentAdminAuditEvents(20) };
  });

  app.get('/admin-authority/proof/approval-requests', { preHandler: buildAdminAuthorityPreHandler(viewPolicy) }, async () => {
    return { ok: true, approvals: await listPendingAdminApprovalRequests(20) };
  });
}

export default adminAuthorityProofPlugin;
