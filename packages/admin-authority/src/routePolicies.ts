import type { AdminPermission } from './permissions';

export type AdminHttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type AdminRoutePolicy = { method: AdminHttpMethod; pathPattern: string; permission: AdminPermission; sensitive: boolean; approvalRequired: boolean; auditEvent: string; };

export const ADMIN_ROUTE_POLICIES: AdminRoutePolicy[] = [
  { method: 'GET', pathPattern: '/api/admin/command-center', permission: 'admin.command_center.view', sensitive: false, approvalRequired: false, auditEvent: 'admin.command_center.viewed' },
  { method: 'GET', pathPattern: '/api/admin/users', permission: 'admin.users.view', sensitive: true, approvalRequired: false, auditEvent: 'admin.users.listed' },
  { method: 'POST', pathPattern: '/api/admin/users', permission: 'admin.users.manage', sensitive: true, approvalRequired: true, auditEvent: 'admin.users.created' },
  { method: 'PATCH', pathPattern: '/api/admin/users/:id/roles', permission: 'admin.roles.manage', sensitive: true, approvalRequired: true, auditEvent: 'admin.roles.changed' },
  { method: 'POST', pathPattern: '/api/admin/sessions/:id/revoke', permission: 'admin.sessions.revoke', sensitive: true, approvalRequired: false, auditEvent: 'admin.sessions.revoked' },
  { method: 'POST', pathPattern: '/api/admin/kb/sources', permission: 'admin.kb.manage', sensitive: true, approvalRequired: false, auditEvent: 'admin.kb.source.created' },
  { method: 'POST', pathPattern: '/api/admin/kb/sources/:id/publish', permission: 'admin.kb.publish', sensitive: true, approvalRequired: true, auditEvent: 'admin.kb.source.published' },
  { method: 'POST', pathPattern: '/api/admin/kb/sources/:id/retire', permission: 'admin.kb.retire', sensitive: true, approvalRequired: true, auditEvent: 'admin.kb.source.retired' },
  { method: 'POST', pathPattern: '/api/admin/documents/:id/publish', permission: 'admin.documents.publish', sensitive: true, approvalRequired: true, auditEvent: 'admin.documents.published' },
  { method: 'POST', pathPattern: '/api/admin/procedures/:id/publish', permission: 'admin.procedures.publish', sensitive: true, approvalRequired: true, auditEvent: 'admin.procedures.published' },
  { method: 'POST', pathPattern: '/api/admin/payments/overrides', permission: 'admin.payments.override', sensitive: true, approvalRequired: true, auditEvent: 'admin.payments.override.requested' },
  { method: 'POST', pathPattern: '/api/admin/payments/notices/:id/publish', permission: 'admin.payments.publish_notice', sensitive: true, approvalRequired: true, auditEvent: 'admin.payments.notice.published' },
  { method: 'POST', pathPattern: '/api/admin/salary/formulas', permission: 'admin.salary.manage_formula', sensitive: true, approvalRequired: true, auditEvent: 'admin.salary.formula.created' },
  { method: 'POST', pathPattern: '/api/admin/salary/formulas/:id/publish', permission: 'admin.salary.publish_formula', sensitive: true, approvalRequired: true, auditEvent: 'admin.salary.formula.published' },
  { method: 'POST', pathPattern: '/api/admin/chatbot/overrides', permission: 'admin.chatbot.override', sensitive: true, approvalRequired: true, auditEvent: 'admin.chatbot.override.created' },
  { method: 'POST', pathPattern: '/api/admin/ticker', permission: 'admin.ticker.manage', sensitive: true, approvalRequired: false, auditEvent: 'admin.ticker.item.created' },
  { method: 'POST', pathPattern: '/api/admin/deployment/actions', permission: 'admin.deployment.operate', sensitive: true, approvalRequired: true, auditEvent: 'admin.deployment.action.requested' },
  { method: 'POST', pathPattern: '/api/admin/approvals/:id/decide', permission: 'admin.approvals.decide', sensitive: true, approvalRequired: false, auditEvent: 'admin.approvals.decided' },
  { method: 'POST', pathPattern: '/api/admin/rollback', permission: 'admin.rollback.execute', sensitive: true, approvalRequired: true, auditEvent: 'admin.rollback.requested' }
];

function pathPatternMatches(pattern: string, actual: string): boolean {
  const patternParts = pattern.split('/').filter(Boolean);
  const actualParts = actual.split('/').filter(Boolean);
  if (patternParts.length !== actualParts.length) return false;
  return patternParts.every((part, index) => part.startsWith(':') || part === actualParts[index]);
}

export function findAdminRoutePolicy(method: string, path: string): AdminRoutePolicy | undefined {
  const normalizedMethod = method.toUpperCase();
  return ADMIN_ROUTE_POLICIES.find((policy) => policy.method === normalizedMethod && pathPatternMatches(policy.pathPattern, path));
}
