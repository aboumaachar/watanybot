export type AdminActor = {
  id: string;
  roles?: string[];
  permissions?: string[];
  isSuperadmin?: boolean;
};

export type AdminRoutePolicy = {
  key: string;
  method: string;
  path: string;
  requiredPermission: string;
  sensitive?: boolean;
  mutating?: boolean;
  auditEvent?: string;
  approvalRequired?: boolean;
  versioned?: boolean;
};

export type AdminAuthorityDecision = {
  allowed: boolean;
  statusCode: 200 | 401 | 403;
  reason: string;
  requiredPermission: string;
  actorId?: string;
};

export const DEFAULT_ADMIN_ROUTE_POLICIES: AdminRoutePolicy[] = [
  {
    key: 'superadmin.shell.read',
    method: 'GET',
    path: '/superadmin',
    requiredPermission: 'superadmin.shell.read',
  },
  {
    key: 'superadmin.audit.read',
    method: 'GET',
    path: '/superadmin/audit',
    requiredPermission: 'superadmin.audit.read',
  },
  {
    key: 'superadmin.feature_controls.read',
    method: 'GET',
    path: '/superadmin/features',
    requiredPermission: 'superadmin.feature_controls.read',
  },
  {
    key: 'superadmin.feature_controls.write',
    method: 'PUT',
    path: '/api/admin/features',
    requiredPermission: 'superadmin.feature_controls.write',
    mutating: true,
    auditEvent: 'superadmin.feature_controls.updated',
  },
  {
    key: 'superadmin.system.read',
    method: 'GET',
    path: '/superadmin/system',
    requiredPermission: 'superadmin.system.read',
  },
  {
    key: 'cms.read',
    method: 'GET',
    path: '/api/admin/cms',
    requiredPermission: 'cms.read',
  },
  {
    key: 'cms.create',
    method: 'POST',
    path: '/api/admin/cms/:domain',
    requiredPermission: 'cms.create',
    mutating: true,
    auditEvent: 'cms.create',
    versioned: true,
  },
  {
    key: 'cms.procedures.attachments.manage',
    method: 'PUT',
    path: '/api/admin/cms/procedures/:id/attachments',
    requiredPermission: 'cms.procedures.attachments.manage',
    mutating: true,
    auditEvent: 'cms.procedures.attachments.updated',
    versioned: true,
  },
  {
    key: 'cms.payload_sync.read',
    method: 'GET',
    path: '/api/admin/cms/payload-sync/status',
    requiredPermission: 'cms.procedures.read',
  },
  {
    key: 'cms.payload_sync.trigger',
    method: 'POST',
    path: '/api/admin/cms/payload-sync/sync',
    requiredPermission: 'cms.publish',
    mutating: true,
    auditEvent: 'cms.payload_sync.requested',
  },
  {
    key: 'cms.edit',
    method: 'PATCH',
    path: '/api/admin/cms/:domain/:id',
    requiredPermission: 'cms.edit',
    mutating: true,
    auditEvent: 'cms.update',
    versioned: true,
  },
  {
    key: 'cms.publish',
    method: 'POST',
    path: '/api/admin/cms/:domain/:id/actions/publish',
    requiredPermission: 'cms.publish',
    mutating: true,
    auditEvent: 'cms.publish',
    versioned: true,
  },
  {
    key: 'cms.unpublish',
    method: 'POST',
    path: '/api/admin/cms/:domain/:id/actions/unpublish',
    requiredPermission: 'cms.unpublish',
    mutating: true,
    auditEvent: 'cms.unpublish',
    versioned: true,
  },
  {
    key: 'cms.archive',
    method: 'POST',
    path: '/api/admin/cms/:domain/:id/actions/archive',
    requiredPermission: 'cms.archive',
    mutating: true,
    auditEvent: 'cms.archive',
    versioned: true,
  },
  {
    key: 'cms.restore',
    method: 'POST',
    path: '/api/admin/cms/:domain/:id/actions/restore',
    requiredPermission: 'cms.restore',
    mutating: true,
    auditEvent: 'cms.restore',
    versioned: true,
  },
  {
    key: 'cms.audit.read',
    method: 'GET',
    path: '/api/admin/cms/:domain/:id/audit',
    requiredPermission: 'cms.audit.read',
  },
  {
    key: 'cms.version.read',
    method: 'GET',
    path: '/api/admin/cms/:domain/:id/versions',
    requiredPermission: 'cms.version.read',
  },
  {
    key: 'cms.bulk.manage',
    method: 'POST',
    path: '/api/admin/cms/:domain/bulk',
    requiredPermission: 'cms.bulk.manage',
    mutating: true,
    auditEvent: 'cms.bulk_action',
    versioned: true,
  },
  {
    key: 'admin.command_center.view',
    method: 'GET',
    path: '/admin/command-center',
    requiredPermission: 'admin.command_center.view',
    sensitive: false,
    mutating: false,
    auditEvent: 'admin.command_center.viewed',
  },
  {
    key: 'admin.users.manage',
    method: 'POST',
    path: '/admin/users',
    requiredPermission: 'admin.users.manage',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.users.changed',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.roles.manage',
    method: 'POST',
    path: '/admin/roles',
    requiredPermission: 'admin.roles.manage',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.roles.changed',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.payments.override',
    method: 'POST',
    path: '/admin/payments/overrides',
    requiredPermission: 'admin.payments.override',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.payments.override_requested',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.salary.manage_formula',
    method: 'POST',
    path: '/admin/salary/formulas',
    requiredPermission: 'admin.salary.manage_formula',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.salary.formula_changed',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.kb.publish',
    method: 'POST',
    path: '/admin/kb/publish',
    requiredPermission: 'admin.kb.publish',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.kb.publish_requested',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.documents.publish',
    method: 'POST',
    path: '/admin/documents/publish',
    requiredPermission: 'admin.documents.publish',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.documents.publish_requested',
    approvalRequired: true,
    versioned: true,
  },
  {
    key: 'admin.deployment.operate',
    method: 'POST',
    path: '/admin/deployment/actions',
    requiredPermission: 'admin.deployment.operate',
    sensitive: true,
    mutating: true,
    auditEvent: 'admin.deployment.action_requested',
    approvalRequired: true,
    versioned: true,
  },
];

function listFromUnknown(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.map(String).filter(Boolean);
}

export function resolveAdminActorFromRequest(request: any): AdminActor | null {
  const candidate = request?.adminUser ?? request?.admin ?? request?.user ?? request?.auth?.user ?? request?.session?.user ?? null;
  if (!candidate) {
    return null;
  }

  const id = String(candidate.id ?? candidate.userId ?? candidate.sub ?? candidate.email ?? '');
  if (!id) {
    return null;
  }

  const roles = listFromUnknown(candidate.roles ?? candidate.roleNames ?? candidate.adminRoles);
  const role = typeof candidate.role === 'string' ? candidate.role : undefined;
  if (role) {
    roles.push(role);
  }

  const permissions = listFromUnknown(candidate.permissions ?? candidate.permissionNames ?? candidate.adminPermissions);
  const permission = typeof candidate.permission === 'string' ? candidate.permission : undefined;
  if (permission) {
    permissions.push(permission);
  }
  const isSuperadmin = candidate.isSuperadmin === true || roles.includes('superadmin') || roles.includes('SUPERADMIN');

  return { id, roles, permissions, isSuperadmin };
}

export function hasAdminPermission(actor: AdminActor | null, requiredPermission: string): boolean {
  if (!actor) {
    return false;
  }
  if (actor.isSuperadmin === true) {
    return true;
  }
  return (actor.permissions ?? []).includes(requiredPermission);
}

export function evaluateAdminAuthority(request: any, policy: AdminRoutePolicy): AdminAuthorityDecision {
  const actor = resolveAdminActorFromRequest(request);
  if (!actor) {
    return {
      allowed: false,
      statusCode: 401,
      reason: 'NO_AUTHENTICATED_ADMIN_ACTOR',
      requiredPermission: policy.requiredPermission,
    };
  }

  if (!hasAdminPermission(actor, policy.requiredPermission)) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'MISSING_ADMIN_PERMISSION',
      requiredPermission: policy.requiredPermission,
      actorId: actor.id,
    };
  }

  return {
    allowed: true,
    statusCode: 200,
    reason: 'ALLOWED',
    requiredPermission: policy.requiredPermission,
    actorId: actor.id,
  };
}

export function buildAdminAuthorityPreHandler(policy: AdminRoutePolicy) {
  return async function adminAuthorityPreHandler(request: any, reply: any): Promise<void> {
    const decision = evaluateAdminAuthority(request, policy);
    request.adminAuthority = { policy, decision };

    if (!decision.allowed) {
      reply.code(decision.statusCode).send({
        ok: false,
        error: decision.reason,
        requiredPermission: decision.requiredPermission,
      });
    }
  };
}

export function getRoutePolicyByKey(key: string): AdminRoutePolicy {
  const policy = DEFAULT_ADMIN_ROUTE_POLICIES.find((item) => item.key === key);
  if (!policy) {
    throw new Error(`Unknown admin route policy: ${key}`);
  }
  return policy;
}
