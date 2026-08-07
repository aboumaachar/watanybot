export const SUPERADMIN_ROLES = [
  'superadmin',
  'admin',
  'kb_manager',
  'content_manager',
  'finance_payment_editor',
  'support_agent',
  'auditor',
  'deployment_operator'
] as const;

export type SuperadminRole = (typeof SUPERADMIN_ROLES)[number];

export const ADMIN_PERMISSIONS = [
  'admin.command_center.view',
  'admin.users.view',
  'admin.users.manage',
  'admin.roles.view',
  'admin.roles.manage',
  'admin.sessions.view',
  'admin.sessions.revoke',
  'admin.kb.view',
  'admin.kb.manage',
  'admin.kb.publish',
  'admin.kb.retire',
  'admin.documents.view',
  'admin.documents.manage',
  'admin.documents.publish',
  'admin.procedures.view',
  'admin.procedures.manage',
  'admin.procedures.publish',
  'admin.payments.view',
  'admin.payments.override',
  'admin.payments.publish_notice',
  'admin.salary.view',
  'admin.salary.manage_formula',
  'admin.salary.publish_formula',
  'admin.chatbot.review',
  'admin.chatbot.override',
  'admin.faq.view',
  'admin.faq.manage',
  'admin.ticker.manage',
  'admin.integrations.view',
  'admin.integrations.manage',
  'admin.deployment.view',
  'admin.deployment.operate',
  'admin.audit.view',
  'admin.approvals.view',
  'admin.approvals.decide',
  'admin.rollback.execute',
  'admin.analytics.view',
  'admin.crm_cases.view',
  'admin.crm_cases.manage'
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

export const DEFAULT_ROLE_PERMISSIONS: Record<SuperadminRole, AdminPermission[]> = {
  superadmin: [...ADMIN_PERMISSIONS],
  admin: ['admin.command_center.view','admin.users.view','admin.roles.view','admin.sessions.view','admin.kb.view','admin.documents.view','admin.procedures.view','admin.payments.view','admin.salary.view','admin.chatbot.review','admin.faq.view','admin.integrations.view','admin.deployment.view','admin.audit.view','admin.approvals.view','admin.analytics.view','admin.crm_cases.view'],
  kb_manager: ['admin.command_center.view','admin.kb.view','admin.kb.manage','admin.kb.publish','admin.documents.view','admin.procedures.view','admin.audit.view'],
  content_manager: ['admin.command_center.view','admin.documents.view','admin.documents.manage','admin.procedures.view','admin.procedures.manage','admin.faq.view','admin.faq.manage','admin.ticker.manage','admin.audit.view'],
  finance_payment_editor: ['admin.command_center.view','admin.payments.view','admin.payments.override','admin.salary.view','admin.audit.view','admin.approvals.view'],
  support_agent: ['admin.command_center.view','admin.chatbot.review','admin.crm_cases.view','admin.crm_cases.manage','admin.documents.view','admin.procedures.view'],
  auditor: ['admin.command_center.view','admin.audit.view','admin.approvals.view','admin.analytics.view'],
  deployment_operator: ['admin.command_center.view','admin.deployment.view','admin.deployment.operate','admin.integrations.view','admin.audit.view']
};

export function hasPermission(granted: readonly string[], required: AdminPermission): boolean {
  return granted.includes(required);
}

export function requirePermission(granted: readonly string[], required: AdminPermission): void {
  if (!hasPermission(granted, required)) {
    const error = new Error(`Forbidden: missing ${required}`);
    (error as Error & { statusCode?: number }).statusCode = 403;
    throw error;
  }
}
