export type CommandCenterTileStatus = 'pass' | 'review' | 'blocked' | 'unknown';
export type CommandCenterTile = { key: string; title: string; status: CommandCenterTileStatus; metric?: string | number; description: string; requiredPermission: string; };
export const COMMAND_CENTER_TILES: CommandCenterTile[] = [
  { key: 'gateway-health', title: 'Gateway Health', status: 'unknown', description: 'Gateway readiness, health, and protected admin API state.', requiredPermission: 'admin.command_center.view' },
  { key: 'rbac', title: 'RBAC / Permissions', status: 'unknown', description: 'Denied-by-default route policy and permission coverage.', requiredPermission: 'admin.roles.view' },
  { key: 'audit', title: 'Audit Events', status: 'unknown', description: 'Immutable audit coverage for mutating admin actions.', requiredPermission: 'admin.audit.view' },
  { key: 'approvals', title: 'Approvals', status: 'unknown', description: 'Pending sensitive actions and two-person approvals.', requiredPermission: 'admin.approvals.view' },
  { key: 'kb', title: 'KB Studio', status: 'unknown', description: 'KB source status, outdated entries, and publish queue.', requiredPermission: 'admin.kb.view' },
  { key: 'payments', title: 'Payment Intelligence', status: 'unknown', description: 'Variable payment notices, overrides, and approval state.', requiredPermission: 'admin.payments.view' },
  { key: 'salary', title: 'Salary / Pension', status: 'unknown', description: 'Formula versions, official source traceability, and test vectors.', requiredPermission: 'admin.salary.view' },
  { key: 'documents', title: 'Documents / Procedures', status: 'unknown', description: 'Document previews, share links, procedure publishing, and archive state.', requiredPermission: 'admin.documents.view' },
  { key: 'integrations', title: 'Integrations', status: 'unknown', description: 'SMS/OTP, WhatsApp, voice, voting, APK/PWA, and deployment status.', requiredPermission: 'admin.integrations.view' },
  { key: 'analytics', title: 'Analytics / CRM Cases', status: 'unknown', description: 'Search failures, KB gaps, procedure demand, payment confusion, and CRM cases.', requiredPermission: 'admin.analytics.view' }
];
